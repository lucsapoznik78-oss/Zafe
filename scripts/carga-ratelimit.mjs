/**
 * Verifica que o rate limit realmente bloqueia — contra um deploy de verdade.
 *
 *   node scripts/carga-ratelimit.mjs https://zafe-abc123.vercel.app
 *   node scripts/carga-ratelimit.mjs <url> --rota /api/kyc --n 30
 *
 * Por que existe, tendo os unitários: `lib/__tests__/ratelimit.test.ts` roda com
 * o @upstash/ratelimit inteiro mockado. Ele prova a lógica de decisão e não
 * prova nada sobre o caminho real — que o middleware casa a rota, que as env
 * vars do Upstash chegaram no runtime Edge, que o sliding window conta de
 * verdade e que o `Retry-After` sai coerente. Só uma requisição real mostra
 * isso.
 *
 * Fica FORA do `npm test` de propósito. Cada execução gasta comandos da cota da
 * Upstash (500 mil/mês no free) e depende de um deploy no ar — em CI seria
 * flaky e caro ao mesmo tempo.
 *
 * NUNCA rodar contra produção: os contadores são compartilhados, então isso
 * bloquearia a conta ou o IP usado no teste para usuários reais.
 */

const [, , baseUrl, ...resto] = process.argv;

function opcao(nome, padrao) {
  const i = resto.indexOf(`--${nome}`);
  return i !== -1 && resto[i + 1] ? resto[i + 1] : padrao;
}

if (!baseUrl || !baseUrl.startsWith("http")) {
  console.error("Uso: node scripts/carga-ratelimit.mjs <url-do-preview> [--rota /api/kyc] [--n 30]");
  process.exit(1);
}

if (/zafe\.app\.br/.test(baseUrl)) {
  console.error("✗ Recusando rodar contra produção.");
  console.error("  Os contadores são compartilhados: isto bloquearia usuários reais.");
  console.error("  Use a URL de um deploy de preview.");
  process.exit(1);
}

// Rota padrão: pré-autenticação, para o script não precisar de sessão. É a
// única política com chave por IP — as de dinheiro usam a conta, e sem cookie
// de sessão todas cairiam no mesmo balde `ip:<addr>`, que não é o que elas
// medem em produção.
const rota = opcao("rota", "/api/auth/username?u=zzz_carga_teste");
const total = Number(opcao("n", 30));

// Bate com `rl:pii:enum` em lib/ratelimit.ts. Se um dos dois mudar, o script
// acusa a divergência em vez de fingir que passou.
const LIMITE_ESPERADO = 20;

const url = new URL(rota, baseUrl).toString();
console.log(`Alvo:   ${url}`);
console.log(`Envios: ${total} (sequenciais — em paralelo a ordem do 429 vira loteria)\n`);

const respostas = [];
for (let i = 1; i <= total; i++) {
  const res = await fetch(url, { headers: { "cache-control": "no-store" } });
  respostas.push({ i, status: res.status, retryAfter: res.headers.get("retry-after") });
  const marca = res.status === 429 ? " ← 429" : res.status === 503 ? " ← 503" : "";
  process.stdout.write(`${String(i).padStart(3)}  ${res.status}${marca}\n`);
}

const primeiro429 = respostas.find((r) => r.status === 429);
const algum503 = respostas.find((r) => r.status === 503);

console.log("");

if (algum503) {
  console.error("✗ Apareceu 503: o middleware não conseguiu falar com o Redis.");
  console.error("  Numa rota fail-closed isso é o comportamento correto sob queda do");
  console.error("  Upstash — mas esta rota é fail-open, então é bug ou config errada.");
  process.exit(1);
}

if (!primeiro429) {
  console.error(`✗ Nenhum 429 em ${total} requisições.`);
  console.error("  Causa mais provável: UPSTASH_REDIS_REST_URL/TOKEN não existem neste");
  console.error("  ambiente. Sem elas o módulo é inerte e libera tudo — silenciosamente.");
  process.exit(1);
}

const esperado = LIMITE_ESPERADO + 1;
const ok = primeiro429.i === esperado;
console.log(
  `${ok ? "✓" : "✗"} primeiro 429 na requisição ${primeiro429.i} (esperado ${esperado})`
);

const ra = Number(primeiro429.retryAfter);
const raOk = ra >= 1 && ra <= 60;
console.log(
  `${raOk ? "✓" : "✗"} Retry-After: ${primeiro429.retryAfter}` +
    (raOk ? "" : "  (esperado entre 1 e 60 — a janela de rl:pii:enum é 1 min)")
);

process.exit(ok && raOk ? 0 : 1);
