/**
 * Configuração versionada do Supabase Auth (Camada 3).
 *
 *   node scripts/configurar-auth.mjs              # dry run: só imprime o diff
 *   node scripts/configurar-auth.mjs --aplicar    # escreve, relê e confere
 *   node scripts/configurar-auth.mjs --captcha <secret>   # liga o Turnstile
 *
 * Por que existe: os limites nativos do GoTrue são a ÚNICA defesa do login da
 * Zafe. A autenticação é 100% client-side — o browser fala direto com
 * `supabase.co/auth/v1/*` e nunca passa pela Vercel, então nem o WAF nem o
 * middleware enxergam uma tentativa de login. Esses números não estão em
 * nenhum arquivo do repositório; ficam num painel onde ninguém revisa. Este
 * script os traz para o controle de versão.
 *
 * Dry run é o padrão de propósito: este endpoint consegue trancar você para
 * fora do próprio auth do projeto.
 *
 * SUPABASE_ACCESS_TOKEN vive SÓ no .env.local, nunca na Vercel — é um token de
 * conta inteira, com poder de apagar projeto. O `ref` é derivado de
 * NEXT_PUBLIC_SUPABASE_URL para o script não conseguir apontar para o projeto
 * errado por engano.
 */

import { readFileSync } from "node:fs";

function carregarEnvLocal() {
  try {
    for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sem .env.local: as vars podem vir do ambiente
  }
}

carregarEnvLocal();

const aplicar = process.argv.includes("--aplicar");
const captchaIdx = process.argv.indexOf("--captcha");
const captchaSecret = captchaIdx !== -1 ? process.argv[captchaIdx + 1] : null;

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN no .env.local.");
  console.error("Gere em: https://supabase.com/dashboard/account/tokens");
  console.error("NÃO coloque esse token na Vercel — ele vale para a conta inteira.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL inválida ou ausente: ${url || "(vazia)"}`);
  process.exit(1);
}

/**
 * Todos os limites do GoTrue são POR HORA e valem para o PROJETO INTEIRO, não
 * por IP nem por usuário. É o que torna os padrões apertados demais: 30 OTPs
 * por hora é o teto somado de todos os usuários da Zafe.
 */
const DESEJADO = {
  // A Zafe queima um OTP em todo login com 2FA ligado. 30/h no projeto inteiro
  // começa a doer com algumas dezenas de usuários ativos.
  rate_limit_otp: 60,

  // Superfície de brute force do código de 6 dígitos. Um humano digita 1-3
  // vezes. NÃO descer de ~100: /verify também serve o link de confirmação de
  // email, e uma rajada de cadastros atrás do mesmo IP de CGNAT (Vivo, Claro,
  // TIM) não pode ser bloqueada junto.
  rate_limit_verify: 240,

  // `signInAnonymously` não aparece em lugar nenhum do código. Se o provider
  // estiver ligado, é criação gratuita de conta batendo no trigger
  // handle_new_user, que escreve em profiles E em wallets.
  rate_limit_anonymous_users: 1,
  external_anonymous_users_enabled: false,

  // Só faz efeito com SMTP customizado. No provedor nativo o teto é 2/h para o
  // projeto inteiro e este campo é ignorado — o script detecta isso na
  // releitura e reporta ✗.
  rate_limit_email_sent: 30,

  // Cada SMS custa dinheiro real, e sendOtp() dispara para qualquer um que
  // acerte email+senha. Isto é teto de gasto, não só de abuso.
  rate_limit_sms_sent: 10,

  // Exige plano Pro. Vai no objeto de propósito: no Free o PATCH é aceito e o
  // valor silenciosamente ignorado, e a releitura transforma isso num ✗
  // visível em vez de numa suposição errada.
  password_hibp_enabled: true,
};

/**
 * Campos deliberadamente FORA do objeto acima — a ausência é a decisão:
 *
 * - `rate_limit_token_refresh` (1800): escala com abas abertas do usuário.
 *   Apertar sob CGNAT desloga gente legítima.
 * - `password_min_length` (6): subir para 8 sem mexer no cliente produz erro
 *   cru em inglês em redefinir-senha/page.tsx, e o signup no LoginForm nem
 *   valida tamanho. Precisa do cliente primeiro.
 * - `password_required_characters` (""): regras de composição empurram para
 *   `Senha@123`. O NIST SP 800-63B desaconselha explicitamente.
 */

// CAPTCHA fica atrás da flag para este script não executar acidentalmente a
// etapa que derruba TODO login, cadastro, reset e OTP se o cliente ainda não
// estiver mandando o token.
if (captchaSecret) {
  DESEJADO.security_captcha_enabled = true;
  DESEJADO.security_captcha_provider = "turnstile";
  DESEJADO.security_captcha_secret = captchaSecret;
}

const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function ler() {
  const res = await fetch(API, { headers });
  if (!res.ok) {
    console.error(`✗ GET ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  return res.json();
}

/** Segredos nunca são impressos — só o fato de estarem presentes. */
function exibir(campo, valor) {
  if (campo.includes("secret")) return valor ? "(definido)" : "(vazio)";
  return JSON.stringify(valor);
}

const atual = await ler();

console.log(`Projeto: ${ref}`);
console.log(aplicar ? "Modo: APLICAR\n" : "Modo: dry run (nada é escrito)\n");

// Diagnóstico que motivou o T-1: o provedor nativo de email é limitado a 2
// emails/hora no projeto inteiro. A Zafe manda email em signup, reenvio de
// confirmação, recuperação de senha e OTP. Com o nativo, o terceiro cadastro
// de cada hora não recebe o email — e o middleware trata email não confirmado
// como não autenticado, então a pessoa cadastra e não consegue entrar.
const temSmtp = Boolean(atual.smtp_host);
console.log(
  temSmtp
    ? `SMTP customizado: ${atual.smtp_host} (rate_limit_email_sent é editável)`
    : "SMTP: PROVEDOR NATIVO — teto de 2 emails/hora no projeto inteiro.\n" +
      "  Configure o Resend em Authentication → SMTP Settings antes de confiar\n" +
      "  em qualquer valor de rate_limit_email_sent."
);
console.log(
  `CAPTCHA: ${atual.security_captcha_enabled ? `ligado (${atual.security_captcha_provider})` : "DESLIGADO"}`
);
console.log("");

const divergentes = Object.entries(DESEJADO).filter(
  ([campo, alvo]) => JSON.stringify(atual[campo]) !== JSON.stringify(alvo)
);

if (divergentes.length === 0) {
  console.log("✓ Nenhuma divergência — a configuração já é a desejada.");
  process.exit(0);
}

console.log("Divergências:");
for (const [campo, alvo] of divergentes) {
  console.log(`  ${campo.padEnd(34)} ${exibir(campo, atual[campo])}  →  ${exibir(campo, alvo)}`);
}
console.log("");

if (!aplicar) {
  console.log("Dry run: nada foi escrito. Rode com --aplicar para gravar.");
  process.exit(0);
}

const res = await fetch(API, {
  method: "PATCH",
  headers,
  body: JSON.stringify(Object.fromEntries(divergentes)),
});
if (!res.ok) {
  console.error(`✗ PATCH ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

// A releitura não é paranoia: o Free aceita o PATCH de password_hibp_enabled e
// ignora o valor. Sem conferir, o script mentiria dizendo que ligou.
const depois = await ler();
let falhou = false;
for (const [campo, alvo] of divergentes) {
  const ok = JSON.stringify(depois[campo]) === JSON.stringify(alvo);
  if (!ok) falhou = true;
  console.log(
    `${ok ? "✓" : "✗"} ${campo.padEnd(34)} ${exibir(campo, depois[campo])}` +
      (ok ? "" : `  (esperado ${exibir(campo, alvo)} — provavelmente exige plano Pro)`)
  );
}

process.exit(falhou ? 1 : 0);
