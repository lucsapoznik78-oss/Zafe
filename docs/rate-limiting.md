# Rate limiting

> **Estado em 2026-07-31 — leia antes de confiar em qualquer coisa abaixo.**
>
> `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` **não existem na
> Vercel**. Sem elas `getRedis()` devolve `null` e `checkRateLimit()` devolve
> `{ ok: true }` incondicionalmente: a Camada 2 inteira está no ar mas **nunca
> limitou uma única requisição**. O código desta página está correto; a
> infraestrutura que ele precisa não foi criada. Criar o banco na Upstash e
> adicionar as duas variáveis é o que liga tudo. A Camada 1 (WAF) está no ar,
> mas em modo Log — conta, não bloqueia.
>
> Idem para o CAPTCHA: o cliente já manda o token, mas
> `NEXT_PUBLIC_TURNSTILE_SITE_KEY` não existe e o toggle no Supabase está
> desligado.

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

> **No ar em modo Log desde 2026-07-31.** Regra `rule_teto_por_ip_Gnyluz`,
> `firewallEnabled: true`. Não bloqueia nada ainda — só conta.
>
> Ao contrário do que se esperava, a ação **Rate Limit do WAF funciona no plano
> Hobby**. Não é preciso esperar o upgrade.

Não existe em código. É um teto bruto contra varredura e scraping, deliberadamente
generoso: **600 requisições por IP a cada 60 segundos**.

Por que folgado: o pico realista medido de um usuário individual é ~60 req/min
(4 req/min ocioso, 20 req/min numa página de evento em resolução, que faz
polling a cada 5s). E, principalmente, **CGNAT** — Vivo, Claro e TIM colocam
muitos assinantes atrás do mesmo IP público, então um limite apertado por IP
derruba usuários legítimos em bloco.

A chave é **IP, não JA4**. JA4 é um fingerprint de TLS: todo Chrome no Android
compartilha o mesmo, o que agruparia usuários legítimos no mesmo balde.

A regra, como está gravada (`GET /v1/security/firewall/config/active`):

```json
{ "name": "Teto por IP",
  "conditionGroup": [{ "conditions": [{ "type": "path", "op": "pre", "value": "/" }] }],
  "action": { "mitigate": { "action": "log",
    "rateLimit": { "algo": "fixed_window", "window": 60, "limit": 600,
                   "keys": ["ip"], "action": "log" } } } }
```

**Como promover para bloqueio.** Trocar os dois `"action": "log"` por `"deny"` —
nunca só um; o de fora decide o que acontece com a requisição, o de dentro o que
acontece ao estourar o contador. Critério, e não antes: **uma semana em Log**, e
promover só se o percentil 99 de req/60s por IP legítimo ficar abaixo de 300, ou
seja, metade do teto. Sem essa medição, promover é chutar — e o custo do erro é
derrubar um IP de CGNAT inteiro (uma cidade atrás de um NAT da Vivo).

Duas limitações do Hobby que valem saber antes de desenhar a segunda regra:
**janela fixa** (não é sliding window, então o dobro do limite passa na virada) e
poucas regras por projeto.

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
| `perfil/completar`, `kyc` (oráculo de CPF) | 5 / 10 min | conta | **fail-closed** |
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

### Como verificar que está mesmo limitando

```
node scripts/carga-ratelimit.mjs <url-de-preview>
```

Dispara N requisições sequenciais e confere que o 429 aparece na requisição
esperada, com `Retry-After` coerente. Fica fora do `npm test`: gasta cota da
Upstash e precisa de um deploy no ar. **Recusa rodar contra produção** — os
contadores são compartilhados e o teste bloquearia usuários reais.

É o único jeito de exercitar o caminho real middleware → Upstash. Os unitários
rodam com o `@upstash/ratelimit` mockado: provam a lógica de decisão e não
provam que as env vars chegaram no runtime Edge. Rodado em 2026-07-31 contra um
preview: 25 de 25 devolveram 200, que é o sintoma exato de módulo inerte.

### Kill switch (`lib/killswitch.ts`)

Interruptor para desligar a Camada 2 inteira **sem deploy**. O cenário que o
justifica: o Upstash degrada, as policies `failClosed` passam a devolver 503 em
toda escrita de dinheiro, e o rate limit vira o incidente.

Store: **Vercel → Edge Config → `zafe-flags`**
(`ecfg_hd55diie0tmhvrulw7g6fpw0gzpp`), chave `ratelimit_disabled`.

- Desliga **só** com o booleano `true`. A string `"true"` digitada no painel não
  desarma nada — um typo não pode derrubar a proteção.
- Propagação ≤ 10s (cache de 10s em escopo de módulo). Sem redeploy.
- **Falha ao ler o interruptor devolve `false`** (proteção ligada). O contrário
  converteria todo fail-closed em fail-open a cada soluço de rede.
- Segunda escotilha: env var `RATELIMIT_DISABLED=1`, que curto-circuita antes de
  qualquer rede. Mas **na Vercel env var só vale depois de um redeploy** — é o
  plano B, não o interruptor.

Por que Edge Config e não uma chave no Redis: domínio de falha independente. Ler
o interruptor do mesmo Redis que caiu não funciona.

A leitura só acontece nas rotas que têm policy — `policyFor()` é regex pura e
roda antes (`middleware.ts`), então navegação comum nunca paga por ela.

### Variáveis de ambiente

Criar em **Vercel → Settings → Environment Variables** (nunca no repositório,
nunca em `.env` commitado):

| Nome | Onde obter | Escopo | Estado |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash → database → REST API | Production, Preview | **ausente** |
| `UPSTASH_REDIS_REST_TOKEN` | idem | Production, Preview | **ausente** |
| `EDGE_CONFIG` | Vercel → Edge Config → `zafe-flags` → Tokens | Production, Preview | configurada |
| `RATELIMIT_DISABLED` | `1` para desligar; criar só durante incidente | Production | não criada |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → site | Production, Preview | **ausente** |

Use **bancos separados** do Upstash para Production e Preview: com o mesmo banco,
um teste em preview consome a cota de produção e os contadores se misturam.

`SUPABASE_ACCESS_TOKEN` (usado por `scripts/configurar-auth.mjs`) vive **só no
`.env.local`, nunca na Vercel** — é um token de conta inteira, com poder de apagar
projeto.

## Camada 3 — Supabase (painel, precisa ser feito por humano)

### CAPTCHA — cliente pronto, interruptor desligado

Ligar CAPTCHA no painel **torna `options.captchaToken` obrigatório**. São
exatamente **6 call sites, todos em `components/auth/LoginForm.tsx`** — o
`verifyCaptcha` do GoTrue envolve só `/signup`, `/recover`, `/resend`,
`/magiclink`, `/otp`, `/token`, `/sso`:

| Chamada | Endpoint |
|---|---|
| `signInWithPassword` | `/token?grant_type=password` |
| `signUp` | `/signup` |
| `resend({ type: "signup" })` | `/resend` |
| `signInWithOtp({ phone })` | `/otp` |
| `signInWithOtp({ email })` | `/otp` |
| `resetPasswordForEmail` | `/recover` |

**Não precisam** (e a doc anterior errava ao listá-los): `verifyOtp` (`/verify`
não passa pelo middleware), `signInWithOAuth` (é redirect), `updateUser` em
`redefinir-senha/page.tsx` (`PUT /user`, autenticado) e `exchangeCodeForSession`
(`grant_type=pkce`, isento).

> `refresh_token` também é isento. É isso que garante que **ligar o CAPTCHA não
> desloga ninguém** — só autenticações novas quebram.

Implementado em `components/auth/useCaptcha.tsx` (Cloudflare Turnstile via
`@marsidev/react-turnstile`). **Inerte sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`**:
o widget não renderiza e `obterToken()` resolve `undefined`, então o payload é
idêntico ao de antes. É por isso que o código já está em produção com o toggle
do Supabase desligado.

O detalhe que o hook resolve: o token do Turnstile é de **uso único** e um submit
pode bater em dois endpoints protegidos (`signInWithPassword` e, com 2FA ligado,
`signInWithOtp`). `obterToken()` consome o token e já reseta o widget. Sem isso,
um segundo submit depois de senha errada reenviaria o token gasto, o GoTrue
devolveria `captcha_failed`, e o formulário diria "Email ou senha inválidos" para
quem digitou a senha certa.

Sequência para ativar (a ordem é o que importa — invertida, o login quebra para
todo mundo):

1. Cloudflare → Turnstile → novo site. Hostnames `zafe.app.br`, `localhost`,
   `vercel.app`. Modo Managed. (Chave de teste `1x00000000000000000000AA` no dev.)
2. Vercel → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` em Production + Preview, e redeploy.
3. **Portão de verificação:** em produção, exercitar os 5 fluxos e conferir no
   DevTools que cada POST leva `gotrue_meta_security.captcha_token`. Não avançar
   sem ter visto nos cinco.
4. Só então ligar o toggle:
   `node scripts/configurar-auth.mjs --captcha <secret> --aplicar`.
5. Re-testar os 5 fluxos.

Rollback é o toggle, não um deploy — segundos. Essa assimetria é a razão da ordem.

### Leaked password protection

`password_hibp_enabled` (checa contra o HaveIBeenPwned). **Exige plano Pro** — no
Free o `PATCH` é aceito e o valor silenciosamente ignorado. O campo já está em
`scripts/configurar-auth.mjs`, e a releitura pós-`PATCH` reporta `✗` enquanto o
projeto estiver no Free. No dia do upgrade é só rodar o script de novo.

### Config versionada do Auth

`scripts/configurar-auth.mjs` traz os limites nativos do GoTrue (que só existem
num painel) para o controle de versão. **Dry run é o padrão**; escrever exige
`--aplicar`. Alvos: `rate_limit_otp` 60, `rate_limit_verify` 240,
`rate_limit_anonymous_users` 1 + provider desligado, `rate_limit_email_sent` 30,
`rate_limit_sms_sent` 10, `password_hibp_enabled` true.

Todos esses limites são **por hora e para o projeto inteiro** — não por IP nem
por usuário. Fora do objeto de propósito: `rate_limit_token_refresh` (escala com
abas abertas; apertar sob CGNAT desloga gente), `password_min_length` (subir para
8 sem mexer no cliente produz erro cru em inglês) e
`password_required_characters` (o NIST SP 800-63B desaconselha).

**`rate_limit_email_sent` só significa algo com SMTP customizado.** No provedor
nativo o teto é 2 emails/hora no projeto inteiro e o campo é ignorado — o script
detecta e avisa. A Zafe manda email em signup, reenvio, recuperação e OTP, e o
middleware trata email não confirmado como não autenticado: com o nativo, o
terceiro cadastro de cada hora não recebe o email e a pessoa não consegue entrar.

Não está machucando ninguém **hoje**: em 2026-07-31, `auth.users` tem 56 contas,
1 não confirmada e **0 cadastros nos últimos 30 dias**. É problema de lançamento,
não incidente em curso — mas morde no primeiro dia de tráfego, e a hora de
configurar o Resend é antes disso, não durante. Confirmar se `smtp_host` está
preenchido exige `SUPABASE_ACCESS_TOKEN` no `.env.local` e um
`node scripts/configurar-auth.mjs` (dry run).

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
  login. Mitigação: CAPTCHA + limite nativo do Supabase — e o CAPTCHA está
  desligado. O contador em `localStorage` do `LoginForm.tsx` **não é controle de
  segurança**: mora no navegador do atacante e some com um F5, uma aba anônima
  ou um `delete` no console. É freio de UX contra clique repetido.
- **Farming de indicação.** `/api/referral/registrar` paga Z$ 50 dos dois lados
  e o caminho "amigo" não tem a dedup por IP que o caminho "streamer" tem.
  Isso é regra de negócio, não volume — limite de requisições não resolve.
- **Webhook de pagamento sem assinatura.** `app/api/concurso/pagamento/webhook`
  é público e não verifica HMAC (há um `TODO` no arquivo). Hoje é inerte porque
  `PIX_PROVIDER` não está configurado. **Precisa ser resolvido antes de o PIX
  entrar no ar** — rate limit não substitui verificação de assinatura, e essa
  rota é justamente a que não pode ser limitada.
  → `docs/audits/ISSUES-ABERTAS.md`

### O que deixou de estar nesta lista

**Enumeração de CPF — fechada.** `/api/perfil/completar` e `/api/kyc` devolviam
400 "CPF inválido" e 409 "CPF já cadastrado", o que dava para varrer. Hoje os
dois caminhos devolvem o mesmo **422** com a mesma string (`ERRO_CPF` em
`lib/cpf.ts`), e o teste de dígito foi movido para junto do `SELECT` de
unicidade — os dois fazem o mesmo trabalho, então nem o relógio separa um do
outro. `components/kyc/CpfForm.tsx` valida o dígito no cliente, então o usuário
honesto nunca chega à mensagem genérica.

## Observabilidade

- **Vercel → Firewall → Observability:** requisições que cruzaram a regra
  `Teto por IP`, por IP. É exatamente o dado que decide se 600 é o número certo
  antes de trocar Log por Deny.
- **Upstash → Console → database → Usage:** comandos/mês. Alerta mental em 400k
  de 500k. Se aproximar, o candidato a cortar é o livro de ofertas (60/min é o
  limite mais caro).
- **Logs da Vercel:** `[ratelimit] Redis indisponível` indica queda do Upstash.
  Se aparecer, as rotas de dinheiro estão devolvendo 503 (fail-closed) — é
  incidente, não ruído.

**O que o plano Hobby não dá, para não perder tempo procurando:** Log Drains são
pagos e a retenção de log de runtime é de **1 hora** — qualquer coisa que
aconteça de madrugada some antes de alguém olhar. Não existe alerta gratuito
sobre log. O free tier do Upstash também não alerta sobre valor de chave; só
manda email quando a cota já estourou.

### Log estruturado

Todo bloqueio emite uma linha JSON no `middleware.ts`: `console.warn` para
`limited` (sistema funcionando) e `console.error` para `unavailable` (o Redis
caiu e escritas de dinheiro estão sendo recusadas — é incidente).

```json
{"evt":"ratelimit","motivo":"limited","policy":"rl:money:palpite",
 "rota":"/api/apostar","tipoChave":"user","limite":30,"janela":"1 m",
 "retryAfter":42,"ts":"..."}
```

**O `identifier` nunca entra no log.** IP é dado pessoal (LGPD art. 5º, II) e
`user:<uuid>` é diretamente identificável; o log é visível a quem tem acesso ao
projeto e seria repassado literalmente a qualquer drain futuro. `tipoChave`
guarda o único bit útil para triagem: tráfego pré-auth ou de conta logada.

### Contadores e alerta

Como o log some em 1 hora, o número que sobrevive fica no Redis:
`registrarBloqueio()` faz `INCR` de `rl:{429|503}:<YYYY-MM-DDTHH>:<prefixo>` com
`EXPIRE` de 26h, passado ao `event.waitUntil()` — nunca atrasa a resposta. Só é
chamado no bloqueio, que é raro: mesmo um ataque de 10 mil requisições custa 20
mil comandos contra a cota de 500 mil/mês.

`lerBloqueios(dia)` reconstrói as 24 chaves de cada prefixo e lê com um `MGET`.
**Nunca `KEYS`** — é O(N) sobre o banco inteiro e bloqueia o Redis.

`lib/ratelimit-alerta.ts` roda de carona no cron diário
`/api/cron/ranking-delta` (05:30 UTC), olha **o dia anterior** (às 05:30 o dia
corrente tem 5h de amostra) e notifica os admins via `notifications` +
web push, com idempotência por marcador. Fica em módulo separado porque
`lib/ratelimit.ts` entra no bundle do middleware, que roda em toda requisição.

Limiares em `LIMIARES` (`lib/ratelimit.ts`): 200 bloqueios/dia nos prefixos de
dinheiro e no de CPF, 500 em `rl:pii:enum`. São chutes calibrados pelo custo do
falso positivo — não existe dado ainda. Para o 503 **não há limiar: qualquer
ocorrência alerta.**

> Depende de duas coisas que hoje não existem: o Upstash (sem ele
> `lerBloqueios` devolve `null`, que é diferente de zero) e os crons
> (`docs/audits/CRONS-NAO-DISPARAM.md`).

## Estado dos crons

Ortogonal a rate limit, mas registrado aqui porque foi descoberto na mesma
auditoria: os **19 crons declarados em `vercel.json` nunca dispararam**. As rotas
funcionam (invocação manual com o `CRON_SECRET` responde 200 e escreve), o
gatilho é que está morto. Ver `docs/audits/CRONS-NAO-DISPARAM.md`.
