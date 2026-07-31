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

  // PII — o CPF é um oráculo de enumeração: respostas distinguíveis entre
  // "inválido" (400) e "já cadastrado em outra conta" (409) permitem varrer
  // CPFs para descobrir quem tem conta na Zafe. O limite reduz o alcance da
  // varredura; a correção de verdade é uniformizar a mensagem de erro.
  //
  // As duas rotas entram juntas: fazem a mesma consulta de CPF contra a mesma
  // tabela, então limitar só uma deixa a outra como oráculo aberto do lado.
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
