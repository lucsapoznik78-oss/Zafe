/**
 * Testes do rate limit (lib/ratelimit.ts).
 *
 * O foco é o comportamento que protege dinheiro: contar certo, devolver
 * Retry-After coerente e — o mais importante — reagir à queda do Redis de
 * forma diferente conforme a rota seja de leitura (fail-open) ou de saldo
 * (fail-closed).
 *
 * O Redis é falsificado via mock do @upstash/redis: o helper só cria o client
 * quando as env vars existem, então elas são setadas antes do import.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

/**
 * Estado do Redis falso. `falhar` liga a simulação de indisponibilidade.
 */
const fake = {
  store: new Map<string, { count: number; reset: number }>(),
  falhar: false,
};

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private limit_: number;
    private windowMs: number;
    private prefix: string;

    constructor(opts: { limiter: { limit: number; windowMs: number }; prefix: string }) {
      this.limit_ = opts.limiter.limit;
      this.windowMs = opts.limiter.windowMs;
      this.prefix = opts.prefix;
    }

    static slidingWindow(limit: number, window: string) {
      const [n, unit] = window.split(" ");
      const mult = unit.startsWith("s") ? 1000 : unit.startsWith("m") ? 60_000 : 3_600_000;
      return { limit, windowMs: Number(n) * mult };
    }

    async limit(identifier: string) {
      if (fake.falhar) throw new Error("Redis indisponível");
      const key = `${this.prefix}:${identifier}`;
      const agora = Date.now();
      const atual = fake.store.get(key);
      const janela =
        atual && atual.reset > agora ? atual : { count: 0, reset: agora + this.windowMs };
      janela.count += 1;
      fake.store.set(key, janela);
      return {
        success: janela.count <= this.limit_,
        reset: janela.reset,
        pending: Promise.resolve(),
      };
    }
  }
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => ({ Redis: class {} }));

const { checkRateLimit, policyFor } = await import("@/lib/ratelimit");

const DINHEIRO = { prefix: "t:money", limit: 3, window: "1 m" as const, failClosed: true };
const LEITURA = { prefix: "t:read", limit: 3, window: "1 m" as const, failClosed: false };

beforeEach(() => {
  fake.store.clear();
  fake.falhar = false;
});

describe("checkRateLimit", () => {
  it("libera enquanto está abaixo do limite", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(DINHEIRO, "user:abc");
      expect(r.ok).toBe(true);
    }
  });

  it("bloqueia acima do limite com Retry-After positivo", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(DINHEIRO, "user:abc");

    const r = await checkRateLimit(DINHEIRO, "user:abc");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deveria ter bloqueado");
    expect(r.reason).toBe("limited");
    if (r.reason !== "limited") throw new Error("reason errado");
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("conta por identificador — um usuário não gasta a cota do outro", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(DINHEIRO, "user:abc");
    expect((await checkRateLimit(DINHEIRO, "user:abc")).ok).toBe(false);
    expect((await checkRateLimit(DINHEIRO, "user:xyz")).ok).toBe(true);
  });

  it("fail-open: Redis fora do ar libera rota de leitura", async () => {
    fake.falhar = true;
    const r = await checkRateLimit(LEITURA, "ip:1.2.3.4");
    expect(r.ok).toBe(true);
  });

  it("fail-closed: Redis fora do ar recusa rota de dinheiro", async () => {
    fake.falhar = true;
    const r = await checkRateLimit(DINHEIRO, "user:abc");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("deveria ter recusado");
    expect(r.reason).toBe("unavailable");
  });
});

describe("policyFor", () => {
  it("nunca limita o webhook de pagamento nem os crons", () => {
    expect(policyFor("/api/concurso/pagamento/webhook")).toBeNull();
    expect(policyFor("/api/cron/finalizar-concurso")).toBeNull();
  });

  it("não limita rotas de leitura/polling", () => {
    expect(policyFor("/api/liga/abc-123/status")).toBeNull();
    expect(policyFor("/api/carteira")).toBeNull();
    expect(policyFor("/api/concurso/ranking")).toBeNull();
    expect(policyFor("/liga")).toBeNull();
  });

  it("cobre as rotas que movimentam saldo, sempre fail-closed", () => {
    const rotas = [
      "/api/apostar",
      "/api/games/palpitar",
      "/api/concurso/palpitar",
      "/api/liga/abc-123/palpitar",
      "/api/comunidade/abc-123/palpitar",
      "/api/concurso/inscrever",
      "/api/concurso/reentrar",
      "/api/concurso/pagamento/criar",
      "/api/referral/registrar",
      "/api/bonus-diario",
      "/api/apostas-privadas/criar",
      "/api/apostas-privadas/abc-123/aceitar",
      "/api/liga/abc-123/ordem",
      "/api/topicos/abc-123/ordem",
      "/api/topicos/abc-123/ordem/order-9",
    ];
    for (const rota of rotas) {
      const p = policyFor(rota);
      expect(p, `sem política para ${rota}`).not.toBeNull();
      expect(p!.failClosed, `${rota} deveria ser fail-closed`).toBe(true);
    }
  });

  it("rotas de enumeração pré-auth são fail-open", () => {
    for (const rota of ["/api/auth/email-exists", "/api/auth/username"]) {
      expect(policyFor(rota)!.failClosed).toBe(false);
    }
  });

  it("o oráculo de CPF tem janela longa e é fail-closed nas DUAS rotas", () => {
    // /api/kyc consulta o mesmo CPF na mesma tabela que /api/perfil/completar.
    // Se só uma estiver na política, a outra é um oráculo sem limite nenhum.
    for (const rota of ["/api/perfil/completar", "/api/kyc"]) {
      const p = policyFor(rota);
      expect(p, `sem política para ${rota}`).not.toBeNull();
      expect(p!.failClosed).toBe(true);
      expect(p!.limit).toBe(5);
      expect(p!.window).toBe("10 m");
    }
  });
});
