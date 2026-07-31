/**
 * Testes do kill switch (lib/killswitch.ts).
 *
 * O que precisa ser verdade, em ordem de importância:
 *  1. falha na leitura NÃO desliga a proteção — é o modo de falha que
 *     converteria todo fail-closed em fail-open sem ninguém perceber;
 *  2. a env var curto-circuita antes de qualquer rede;
 *  3. o cache poupa leituras sem prender o valor além de 10s.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const edge = { valor: undefined as unknown, lancar: false, chamadas: 0 };

vi.mock("@vercel/edge-config", () => ({
  get: async (chave: string) => {
    edge.chamadas++;
    if (edge.lancar) throw new Error("Edge Config indisponível");
    return chave === "ratelimit_disabled" ? edge.valor : undefined;
  },
}));

const { rateLimitDesligado, _resetarCache } = await import("@/lib/killswitch");

beforeEach(() => {
  edge.valor = undefined;
  edge.lancar = false;
  edge.chamadas = 0;
  process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_fake?token=fake";
  delete process.env.RATELIMIT_DISABLED;
  _resetarCache();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimitDesligado", () => {
  it("desliga quando a chave está true no Edge Config", async () => {
    edge.valor = true;
    expect(await rateLimitDesligado()).toBe(true);
  });

  it("mantém o rate limit ligado quando a chave não existe", async () => {
    expect(await rateLimitDesligado()).toBe(false);
  });

  it("só aceita o booleano true — string 'true' não desarma nada", async () => {
    // Um valor digitado errado no painel não pode desligar a proteção por acidente.
    edge.valor = "true";
    expect(await rateLimitDesligado()).toBe(false);
  });

  it("a env var curto-circuita sem tocar no Edge Config", async () => {
    process.env.RATELIMIT_DISABLED = "1";
    expect(await rateLimitDesligado()).toBe(true);
    expect(edge.chamadas).toBe(0);
  });

  it("é inerte sem EDGE_CONFIG configurado, sem chamar get", async () => {
    delete process.env.EDGE_CONFIG;
    expect(await rateLimitDesligado()).toBe(false);
    expect(edge.chamadas).toBe(0);
  });

  it("erro de leitura NÃO desarma a proteção", async () => {
    edge.lancar = true;
    expect(await rateLimitDesligado()).toBe(false);
  });

  it("erro não é cacheado — o request seguinte tenta de novo", async () => {
    edge.lancar = true;
    expect(await rateLimitDesligado()).toBe(false);

    edge.lancar = false;
    edge.valor = true;
    expect(await rateLimitDesligado()).toBe(true);
  });

  it("cacheia por 10s e volta a ler depois", async () => {
    vi.useFakeTimers();
    edge.valor = true;

    expect(await rateLimitDesligado()).toBe(true);
    expect(await rateLimitDesligado()).toBe(true);
    expect(edge.chamadas).toBe(1);

    // Dentro da janela, mudar o valor na store não tem efeito ainda.
    edge.valor = false;
    vi.advanceTimersByTime(9_000);
    expect(await rateLimitDesligado()).toBe(true);
    expect(edge.chamadas).toBe(1);

    // Passados os 10s, a leitura acontece de novo e o novo valor vale.
    vi.advanceTimersByTime(2_000);
    expect(await rateLimitDesligado()).toBe(false);
    expect(edge.chamadas).toBe(2);
  });
});
