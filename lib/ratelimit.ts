/**
 * Rate limiting da camada de aplicação (Camada 2).
 *
 * Roda no middleware, não nas rotas: é um ponto único de auditoria e o
 * `user.id` já foi resolvido lá, o que permite usar a conta como chave em vez
 * do IP. IP sozinho é uma chave fraca no Brasil — Vivo, Claro e TIM colocam
 * muito assinante atrás do mesmo IP público (CGNAT), então limitar por IP
 * pune usuários legítimos junto com o abusador. IP fica só como fallback para
 * as rotas pré-autenticação, onde não existe conta ainda.
 *
 * NÃO cobre o login: a autenticação da Zafe é 100% client-side (o browser fala
 * direto com `supabase.co/auth/v1/*`) e nunca passa pela Vercel. Credential
 * stuffing é problema do CAPTCHA + limite nativo do Supabase (Camada 3).
 *
 * Sem UPSTASH_REDIS_REST_URL/TOKEN configurados o módulo inteiro é inerte e
 * libera tudo — o deploy não quebra enquanto o Redis não existir.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface Policy {
  /** Namespace da chave no Redis. */
  prefix: string;
  /** Requisições permitidas na janela. */
  limit: number;
  /** Janela deslizante. */
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
  /**
   * O que fazer quando o Redis está fora do ar.
   *
   * `false` (fail-open) para leitura e rotas pré-auth: indisponibilidade do
   * Redis não pode derrubar o produto inteiro.
   *
   * `true` (fail-closed) para tudo que mexe em saldo: sem contador confiável,
   * é preferível recusar a operação a permitir repetição ilimitada de uma
   * escrita monetária.
   */
  failClosed: boolean;
}

/**
 * Ordem importa: a primeira regra que casar vence. Rotas mais específicas
 * primeiro.
 *
 * Os números são folgados de propósito. O objetivo é cortar automação, não
 * incomodar quem usa o app: o pico realista medido de um usuário individual é
 * ~60 req/min no app inteiro, e um humano não registra 30 palpites por minuto.
 */
export const POLICIES: Array<{ pattern: RegExp; policy: Policy }> = [
  // Dinheiro — criação de obrigação em R$ ou movimentação de saldo pontual.
  {
    pattern:
      /^\/api\/(concurso\/(inscrever|reentrar|pagamento\/criar)|referral\/registrar|bonus-diario|apostas-privadas\/criar)$/,
    policy: { prefix: "rl:money:critical", limit: 10, window: "1 m", failClosed: true },
  },
  {
    pattern: /^\/api\/apostas-privadas\/[^/]+\/aceitar$/,
    policy: { prefix: "rl:money:critical", limit: 10, window: "1 m", failClosed: true },
  },
  {
    pattern: /^\/api\/escalacao\/inscrever$/,
    policy: { prefix: "rl:money:critical", limit: 10, window: "1 m", failClosed: true },
  },
  {
    pattern: /^\/api\/perfil\/figura\/(desbloquear|comprar)$/,
    policy: { prefix: "rl:money:critical", limit: 10, window: "1 m", failClosed: true },
  },

  // Salvar o personagem — a ÚNICA escrita binária do app. Ganha prefixo próprio
  // porque um loop aqui ataca o custo de storage/egress, não o saldo: a rota não
  // move Z$. E `failClosed: false` pelo mesmo motivo — Redis fora do ar não pode
  // impedir alguém de salvar um chapéu.
  {
    pattern: /^\/api\/perfil\/figura$/,
    policy: { prefix: "rl:figura:save", limit: 12, window: "5 m", failClosed: false },
  },

  // Dinheiro — palpites (débito imediato de Z$/ZC$).
  {
    pattern:
      /^\/api\/(apostar|games\/palpitar|concurso\/palpitar|(liga|economico|comunidade)\/[^/]+\/palpitar)$/,
    policy: { prefix: "rl:money:palpite", limit: 30, window: "1 m", failClosed: true },
  },

  // Dinheiro — livro de ofertas. Trader clica mais que apostador, teto maior.
  {
    pattern: /^\/api\/(liga|topicos)\/[^/]+\/ordem(\/[^/]+)?$/,
    policy: { prefix: "rl:money:ordem", limit: 60, window: "1 m", failClosed: true },
  },

  // PII — consulta de CPF. As respostas já são indistinguíveis (as duas rotas
  // devolvem o mesmo 422 com a mesma string, ver ERRO_CPF em lib/cpf.ts), então
  // isto não é mais o remédio principal contra enumeração — é o teto de volume
  // que sobra: 5/10min torna uma varredura de CPFs inviável mesmo se um caminho
  // vazar por outro meio no futuro.
  //
  // As duas rotas entram juntas: fazem a mesma consulta contra a mesma tabela,
  // então limitar só uma deixa a outra como porta aberta do lado.
  {
    pattern: /^\/api\/(perfil\/completar|kyc)$/,
    policy: { prefix: "rl:pii:cpf", limit: 5, window: "10 m", failClosed: true },
  },

  // PII pré-autenticação — enumeração de contas e de usernames. Chave por IP
  // (não há conta ainda) e fail-open: derrubar o cadastro inteiro porque o
  // Redis caiu é pior que o abuso que isso previne.
  {
    pattern: /^\/api\/auth\/(email-exists|username)$/,
    policy: { prefix: "rl:pii:enum", limit: 20, window: "1 m", failClosed: false },
  },
];

/**
 * Rotas que NUNCA podem ser limitadas.
 *
 * - Webhook de pagamento: o provedor PIX faz retry automático e trata 429 como
 *   falha de entrega. Limitar aqui significa perder confirmação de pagamento.
 * - Crons: chamados pela Vercel em rajada, autenticados por Bearer secret.
 */
const NEVER_LIMIT = [/^\/api\/concurso\/pagamento\/webhook$/, /^\/api\/cron\//];

export function policyFor(pathname: string): Policy | null {
  if (NEVER_LIMIT.some((r) => r.test(pathname))) return null;
  return POLICIES.find(({ pattern }) => pattern.test(pathname))?.policy ?? null;
}

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(policy: Policy): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  const key = `${policy.prefix}:${policy.limit}:${policy.window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      // Sliding window: sem o efeito de borda da janela fixa, onde o dobro do
      // limite passa na virada. `analytics` fica desligado porque cada evento
      // custa comandos extras no plano gratuito da Upstash (500k/mês).
      limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
      prefix: policy.prefix,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export type RateLimitResult =
  | { ok: true; pending?: Promise<unknown> }
  | { ok: false; reason: "limited"; retryAfter: number }
  | { ok: false; reason: "unavailable" };

/**
 * @param identifier chave já resolvida pelo chamador: `user:<uuid>` quando há
 * sessão, `ip:<addr>` caso contrário.
 */
export async function checkRateLimit(
  policy: Policy,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getLimiter(policy);
  // Sem Redis configurado o rate limit não existe — libera.
  if (!limiter) return { ok: true };

  try {
    const { success, reset, pending } = await limiter.limit(identifier);
    if (success) return { ok: true, pending };
    // `reset` é epoch em ms. Arredonda pra cima e garante ao menos 1s para não
    // devolver `Retry-After: 0`, que alguns clientes interpretam como "já".
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { ok: false, reason: "limited", retryAfter };
  } catch (err) {
    console.error("[ratelimit] Redis indisponível", err);
    return policy.failClosed ? { ok: false, reason: "unavailable" } : { ok: true };
  }
}

/**
 * Contador horário de bloqueios, para que exista um número a olhar depois.
 *
 * O log da Vercel não serve para isso no plano Hobby: a retenção de runtime é de
 * 1 hora e Log Drains são pagos, então um pico de madrugada some antes de
 * alguém acordar. O contador vive no Redis e sobrevive 26h.
 *
 * A chave é determinística (`rl:429:<YYYY-MM-DDTHH>:<prefix>`) justamente para
 * que a leitura possa reconstruir as 24 chaves do dia e usar `MGET`. Nunca
 * `KEYS` — é O(N) sobre o banco inteiro e bloqueia o Redis.
 *
 * Só é chamada no bloqueio, que é raro por construção: mesmo um ataque de 10 mil
 * requisições custa 20 mil comandos contra a cota de 500 mil/mês. E é exatamente
 * o tráfego que vale pagar para enxergar.
 *
 * Devolve uma promessa para o chamador passar ao `event.waitUntil()` — a
 * contagem nunca deve atrasar a resposta de 429.
 */
export function registrarBloqueio(
  prefix: string,
  motivo: "limited" | "unavailable"
): Promise<unknown> | undefined {
  const client = getRedis();
  if (!client) return undefined;
  const hora = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const chave = `rl:${motivo === "unavailable" ? "503" : "429"}:${hora}:${prefix}`;
  return client
    .incr(chave)
    .then(() => client.expire(chave, 26 * 60 * 60))
    .catch(() => {
      // Se o Redis caiu, o contador é a menor das perdas — e no caso
      // `unavailable` ele já caiu por definição.
    });
}

/** Prefixos observados, mais o pseudo-prefixo do 503. */
const PREFIXOS = [...new Set(POLICIES.map(({ policy }) => policy.prefix))];

/**
 * Soma as 24 horas de um dia para cada prefixo. As chaves são reconstruídas
 * deterministicamente e lidas com um `MGET` — nunca `KEYS`, que varre o banco
 * inteiro e bloqueia o Redis enquanto roda.
 *
 * @param dia `YYYY-MM-DD`. Sem Redis devolve `null` (não zero — a diferença
 * entre "nenhum bloqueio" e "não sei" importa para quem lê o alerta).
 */
export async function lerBloqueios(
  dia: string
): Promise<{ bloqueios: Record<string, number>; indisponivel: Record<string, number> } | null> {
  const client = getRedis();
  if (!client) return null;

  const horas = Array.from({ length: 24 }, (_, h) => `${dia}T${String(h).padStart(2, "0")}`);
  // O prefixo tem `:` dentro, então não dá para recuperá-lo cortando a chave
  // depois. A lista paralela guarda a origem de cada posição.
  const alvos = PREFIXOS.flatMap((prefixo) =>
    (["429", "503"] as const).flatMap((tipo) =>
      horas.map((hora) => ({ prefixo, tipo, chave: `rl:${tipo}:${hora}:${prefixo}` }))
    )
  );

  const valores = await client.mget<(number | null)[]>(...alvos.map((a) => a.chave));

  const bloqueios: Record<string, number> = {};
  const indisponivel: Record<string, number> = {};
  alvos.forEach(({ prefixo, tipo }, i) => {
    const n = Number(valores[i] ?? 0);
    if (!n) return;
    const destino = tipo === "503" ? indisponivel : bloqueios;
    destino[prefixo] = (destino[prefixo] ?? 0) + n;
  });

  return { bloqueios, indisponivel };
}

/**
 * Acima de quantos bloqueios num dia vale acordar alguém.
 *
 * São chutes calibrados pelo custo do falso positivo, não por dado — não existe
 * dado ainda. Rever depois de uma semana de contagem real.
 */
export const LIMIARES: Record<string, number> = {
  "rl:money:critical": 200,
  "rl:money:palpite": 200,
  "rl:money:ordem": 200,
  "rl:figura:save": 300,
  "rl:pii:cpf": 200,
  "rl:pii:enum": 500,
};
