# Rate limiting

## O fato que determina o desenho

A autenticação da Zafe é **100% client-side**. O browser fala direto com
`mhckuhqyyfoapzgrqeco.supabase.co/auth/v1/*` (ver `components/auth/LoginForm.tsx`)
e com `/rest/v1/*` do PostgREST. Esse tráfego **nunca passa pela Vercel**.

São duas superfícies independentes:

| Superfície | Passa pela Vercel? | Quem protege |
|---|---|---|
| Páginas e `/api/*` (Route Handlers) | sim | Vercel WAF + middleware (Camadas 1 e 2) |
| `supabase.co/auth/v1/*` e `/rest/v1/*` | **não** | Só o próprio Supabase (Camada 3) |

Duas consequências práticas:

1. Rate limit por conta contra **credential stuffing não tem onde ser
   implementado** sem mover o login para o servidor. Enquanto isso não
   acontecer, quem segura esse cenário é o CAPTCHA + o limite nativo do
   Supabase.
2. A armadilha do header `Sb-Forwarded-For` **não se aplica aqui**. Ela só
   morde quem faz proxy do auth pelo backend — o Supabase passaria a ver o IP
   do servidor e limitaria todo mundo junto. Como o browser fala direto, o
   Supabase já enxerga o IP real do usuário.

## Camada 1 — Vercel WAF (teto geral, feito no painel)

Não existe em código. É um teto bruto contra varredura e scraping, deliberadamente
generoso: **600 requisições por IP a cada 60 segundos**.

Por que folgado: o pico realista medido de um usuário individual é ~60 req/min
(4 req/min ocioso, 20 req/min numa página de evento em resolução, que faz
polling a cada 5s). E, principalmente, **CGNAT** — Vivo, Claro e TIM colocam
muitos assinantes atrás do mesmo IP público, então um limite apertado por IP
derruba usuários legítimos em bloco.

A chave é **IP, não JA4**. JA4 é um fingerprint de TLS: todo Chrome no Android
compartilha o mesmo, o que agruparia usuários legítimos no mesmo balde.

Passos no painel (Vercel → projeto `zafe` → Firewall):

1. **Configure → Rate Limit → Add Rule.**
2. Condição: `Request Path` `starts with` `/`.
3. Chave (`Rate limit by`): **IP Address**.
4. Limite: **600** requisições / janela de **60s**.
5. Ação: **Log** (não Deny).
6. Salvar e **deployar as regras** (o painel exige publicar).
7. Deixar em Log por ~1 semana, olhar o gráfico em Firewall → Observability e
   só então trocar para **Deny** — se algum IP legítimo de CGNAT estourar 600,
   é melhor descobrir no log do que no suporte.

Limites do plano Hobby, para não perder tempo: **1 regra de rate limit por
projeto**, no máximo 3 regras de firewall no total, e janela fixa entre 10s e
10min (não é sliding window).

## Camada 2 — Aplicação (`lib/ratelimit.ts` + `middleware.ts`)

Roda no **middleware**, não em cada rota. Motivos: um único ponto de auditoria
em vez de 15 edições espalhadas, e o `user.id` já foi resolvido pelo
`auth.getUser()` do middleware — o que permite usar **a conta como chave**, não
o IP. IP fica só como fallback nas rotas pré-autenticação.

Backend: Upstash Redis via REST (`@upstash/ratelimit` + `@upstash/redis`),
compatível com o runtime Edge.

### Limites

| Rotas | Limite | Chave | Se o Redis cair |
|---|---|---|---|
| `concurso/inscrever`, `concurso/reentrar`, `concurso/pagamento/criar`, `referral/registrar`, `bonus-diario`, `apostas-privadas/criar`, `apostas-privadas/*/aceitar` | 10 / 1 min | conta | **fail-closed** |
| `apostar`, `games/palpitar`, `concurso/palpitar`, `{liga,comunidade}/*/palpitar` | 30 / 1 min | conta | **fail-closed** |
| `{liga,topicos}/*/ordem` (livro de ofertas) | 60 / 1 min | conta | **fail-closed** |
| `perfil/completar` (oráculo de CPF) | 5 / 10 min | conta | **fail-closed** |
| `auth/email-exists`, `auth/username` | 20 / 1 min | IP | fail-open |

Nada mais é limitado no Redis. As rotas de polling (`status`, `carteira`,
`ranking`, `orderbook`) ficam **de fora de propósito**: um único usuário com uma
aba aberta gera ~17.280 checagens/dia, e o plano gratuito da Upstash dá 500 mil
comandos/mês (mudou de 10k/dia para isso em março de 2025). A ~3 comandos por
checagem de sliding window, incluir polling estouraria a cota com um punhado de
usuários. O escopo atual cabe com folga.

### Fail-open vs fail-closed

- **Leitura e pré-auth → fail-open.** Se o Redis cair, libera. Indisponibilidade
  do Upstash não pode derrubar o cadastro e a navegação.
- **Dinheiro → fail-closed.** Sem contador confiável, recusa (HTTP 503 +
  `Retry-After: 30`). É preferível recusar um palpite a permitir repetição
  ilimitada de uma escrita monetária durante o apagão.

### Detalhes que importam

- **Nunca limitado:** `/api/concurso/pagamento/webhook` (o provedor PIX trata
  429 como falha de entrega e faz retry — limitar significa perder confirmação
  de pagamento) e `/api/cron/*` (rajada legítima da Vercel, já autenticado por
  Bearer secret).
- **429 não vaza existência de conta.** A mensagem é genérica ("Muitas
  requisições") e igual para conta existente ou não.
- `Retry-After` sempre ≥ 1s.
- A escrita do contador vai para `event.waitUntil()` — não segura a resposta.
- **Sem `UPSTASH_REDIS_REST_URL`/`TOKEN` o módulo é inerte** e libera tudo. O
  deploy não quebra enquanto o Redis não existir.

### Variáveis de ambiente

Criar em **Vercel → Settings → Environment Variables** (nunca no repositório,
nunca em `.env` commitado):

| Nome | Onde obter | Escopo |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash → database → REST API | Production, Preview |
| `UPSTASH_REDIS_REST_TOKEN` | idem | Production, Preview |

Use **bancos separados** para Production e Preview: com o mesmo banco, um teste
em preview consome a cota de produção e os contadores se misturam.

## Camada 3 — Supabase (painel, precisa ser feito por humano)

### CAPTCHA — a ordem importa

Ligar CAPTCHA no painel **torna `options.captchaToken` obrigatório em todas as
chamadas de auth**. Existem 7 call sites: `components/auth/LoginForm.tsx`
(`signInWithPassword`, `signUp`, `resend`, `signInWithOtp` ×2, `verifyOtp` ×2) e
`app/(auth)/redefinir-senha/page.tsx`.

Sequência correta:

1. Criar o site em Cloudflare Turnstile (ou hCaptcha) e pegar site key + secret.
2. Subir o **cliente enviando o token** primeiro (com o CAPTCHA ainda desligado
   no painel — o Supabase ignora o token extra).
3. Só então: **Authentication → Settings → Bot and Abuse Protection → Enable
   CAPTCHA**, colar o secret.

Invertido, o login quebra para todos os usuários entre o passo 3 e o deploy do
cliente.

### Leaked password protection

Authentication → Providers → Email → **Prevent use of leaked passwords** (checa
contra o HaveIBeenPwned). É gratuito e não exige mudança de código.

### Limites nativos (referência)

`/auth/v1/token` já é limitado pelo Supabase em **1800 req/h por IP**, com burst
de 30. Não é configurável no painel.

**Bug conhecido (jan/2026):** os limites de sign-in configurados na aba
Authentication → Rate Limits podem não ser aplicados. Não confie neles como
única defesa — o CAPTCHA é o que efetivamente segura.

### `statement_timeout` — não mexer

Já está configurado: `anon` = 3s, `authenticated` = 8s. Os valores que aparecem
em receitas genéricas (5s/10s) seriam **mais frouxos** que o atual. Deixar como
está.

## O que isto NÃO resolve

- **Credential stuffing.** Sem auth no servidor, não há limite por conta no
  login. Mitigação atual: CAPTCHA + limite nativo do Supabase. O
  `localStorage` em `LoginForm.tsx:33-61` é cosmético — some com um F5 ou uma
  aba anônima.
- **Enumeração de CPF.** O limite de 5/10min reduz o alcance, mas a correção de
  verdade é **uniformizar a mensagem de erro** de `/api/perfil/completar`, que
  hoje distingue 400 "CPF inválido" de 409 "CPF já cadastrado em outra conta".
- **Farming de indicação.** `/api/referral/registrar` paga Z$ 50 dos dois lados
  e o caminho "amigo" não tem a dedup por IP que o caminho "streamer" tem.
  Isso é regra de negócio, não volume — limite de requisições não resolve.
- **Webhook de pagamento sem assinatura.** `app/api/concurso/pagamento/webhook`
  é público e não verifica HMAC (há um `TODO` no arquivo). Hoje é inerte porque
  `PIX_PROVIDER` não está configurado. **Precisa ser resolvido antes de o PIX
  entrar no ar** — rate limit não substitui verificação de assinatura, e essa
  rota é justamente a que não pode ser limitada.

## Observabilidade

- **Vercel → Firewall → Observability:** requisições limitadas por regra e por
  IP (é o que valida o número de 600 antes de trocar Log por Deny).
- **Upstash → Console → database → Usage:** comandos/mês. Alerta mental em 400k
  de 500k. Se aproximar, o candidato a cortar é o livro de ofertas (60/min é o
  limite mais caro).
- **Logs da Vercel:** `[ratelimit] Redis indisponível` indica queda do Upstash.
  Se aparecer, as rotas de dinheiro estão devolvendo 503 (fail-closed) — é
  incidente, não ruído.
