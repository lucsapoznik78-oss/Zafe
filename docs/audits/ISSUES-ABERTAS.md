# Issues abertas — registradas, não corrigidas

Levantadas em 2026-07-31 durante o trabalho de rate limiting. Estão aqui **de
propósito sem correção**: cada uma exige uma decisão ou uma mudança de escopo que
não cabia naquele trabalho. Ordenadas por consequência, não por esforço.

---

## 1. Webhook de pagamento não verifica assinatura — bloqueante para o PIX

`app/api/concurso/pagamento/webhook/route.ts:23-24`

```ts
// TODO(pagamento): verificar assinatura usando config.webhookSecret e o header
// de assinatura do provedor escolhido antes de confiar no payload.
```

A rota é pública (está em `publicRoutes` do middleware, como tem que estar — o
provedor não tem sessão) e confia no corpo como veio. Quem souber a URL pode
POSTar `{ data: { id, status: "paid" } }` e disparar
`confirmarPagamentoEInscrever`.

Duas coisas que agravam:

- A rota está em `NEVER_LIMIT` (`lib/ratelimit.ts`), e corretamente: o provedor
  trata 429 como falha de entrega e reenvia, então limitar significa perder
  confirmação de pagamento. **Assinatura é a única defesa que pode existir aqui.**
- A resposta é sempre 200, inclusive quando ignora. Bom para o provedor, ruim
  para detecção — não há sinal de erro para ninguém olhar.

Hoje é inócuo: `getProviderConfig()` devolve `null` porque `PIX_PROVIDER` não
está configurado, e a rota responde `{ ok: true, ignored: "unconfigured" }` antes
de tocar em qualquer coisa.

**Condição de saída:** não configurar `PIX_PROVIDER` em produção antes de a
verificação de HMAC existir e ter teste. O `payerCpf` também precisa vir de
`GET /v1/payments/{id}` na API do provedor, não do corpo do webhook — o comentário
em `:42-43` já sabe disso, mas o código em `:44-47` lê do corpo.

---

## 2. Farming de indicação — Z$ 50 dos dois lados sem teto

`app/api/referral/registrar/route.ts`

O que **já está fechado**: `referrals` tem `UNIQUE (referred_id)`, e o crédito só
acontece se o `INSERT` passar. Um usuário indicado não pode ser pago duas vezes,
e não há corrida.

O que continua aberto: **não há teto por indicador nem custo por conta nova**.
Cada conta criada emite Z$ 100 (50 + 50). O caminho "streamer" logo abaixo, no
mesmo arquivo (`:106-116`), faz dedup por `signup_ip` e marca `rejected`; o
caminho "amigo" (`:41-84`) não olha IP nenhum.

Isso **não é problema de rate limit** — mesmo 10 req/min permitem centenas de
contas por dia, e o gargalo real é criar conta, não chamar a rota. A correção é
invariante de negócio. Candidatos, do mais barato ao mais caro:

- teto de indicações pagas por `referrer_id` (ex.: 20), no banco;
- pagar o bônus do indicador só quando o indicado fizer algo (primeiro palpite,
  CPF completo) — atrasa a emissão até haver sinal de que a conta é real;
- dedup por IP no caminho amigo, igual ao do streamer.

Estado atual: `referrals` está **vazia** (0 linhas). Não houve exploração; é
prevenção antes de o convite ter tração.

---

## 3. Cinco funções `SECURITY DEFINER` chamáveis por `anon`

Apontadas pelo advisor de segurança do Supabase. Confirmado em `pg_proc`:

| Função | Argumento | `anon` pode executar |
|---|---|---|
| `is_liga_creator` | `p_liga_id uuid` | sim |
| `is_liga_invitee` | `p_liga_id uuid` | sim |
| `is_liga_member` | `p_liga_id uuid` | sim |
| `is_liga_public` | `p_liga_id uuid` | sim |
| `is_topic_participant` | `p_topic_id uuid` | sim |

São predicados auxiliares de RLS — recebem UUID e devolvem boolean. Todas têm
`search_path=public` fixado, então não são vulneráveis a sequestro de schema. O
vazamento é fraco: com um UUID em mãos dá para saber "esta liga existe / é
pública". UUID não é enumerável, o que limita bastante o alcance.

Ficam expostas porque o PostgREST publica toda função de `public` em
`/rest/v1/rpc/*`. Como são chamadas de dentro de policies (que rodam como o
dono), **`REVOKE EXECUTE ... FROM anon, authenticated` não quebra a RLS**. Vale
uma migration futura.

---

## 4. `bloquear_alteracao_legal` sem `search_path` fixo

Advisor. Confirmado: `proconfig` nulo, `prosecdef = false`.

É trigger, não é chamável de fora, e não é `SECURITY DEFINER` — então roda com os
privilégios de quem disparou o trigger. Risco baixo. Corrigir com
`SET search_path = ''` (e nomes qualificados) numa migration futura, por higiene.

---

## 5. Senha mínima de 6 e signup que não valida nada

`password_min_length` está em 6 no GoTrue. Subir para 8 exige mexer no cliente
antes, senão o usuário recebe erro cru em inglês:

- `app/(auth)/redefinir-senha/page.tsx:26-27` valida `< 6` com mensagem em pt-BR
  — precisa virar 8 junto;
- `components/auth/LoginForm.tsx` **não valida tamanho nenhum no signup**. Hoje o
  GoTrue é quem recusa, com mensagem em inglês.

Ordem: validar no cliente primeiro (os dois lugares), depois subir
`password_min_length` em `scripts/configurar-auth.mjs`.

Não mexer em `password_required_characters` (regras de composição empurram para
`Senha@123`; o NIST SP 800-63B desaconselha explicitamente). O ganho real está em
`password_hibp_enabled`, que **exige plano Pro** — já está no script e reporta `✗`
enquanto o projeto estiver no Free.

---

## 6. 90 transações com `type` errado (histórico)

`transactions` tem 90 linhas com `type = 'referral_bonus'` cuja `description` diz
"Bônus semanal Zafe" — total Z$ 8.734,03, entre 2026-04-08 e 2026-05-11.

**Não é bug ativo**: `app/api/cron/bonus-semanal/route.ts:67` hoje grava
`type: "weekly_bonus"`. É resíduo da versão anterior da rota.

Consequência: qualquer contabilidade agrupada por `type` está errada nessa janela
— parece haver Z$ 8.734 de bônus de indicação quando o valor real é zero
(`referrals` está vazia). Decidir entre corrigir com um `UPDATE` numa migration ou
apenas documentar. Enquanto não for decidido, **não usar `type = 'referral_bonus'`
como métrica de indicação.**

---

## 7. O fallback manual de cron aponta para um host morto

`.github/workflows/cron.yml` é `workflow_dispatch` only — é a escotilha manual
para quando os Vercel Crons falham. Todas as 6 chamadas apontam para
`https://zafe-rho.vercel.app/...`, que hoje devolve **404**.

Ou seja: os crons não disparam (ver `CRONS-NAO-DISPARAM.md`) **e** o plano B para
dispará-los à mão também está quebrado. Trocar por `https://www.zafe.app.br` é uma
linha por step. Deixado aqui e não corrigido porque a decisão sobre o gatilho
principal (pg_cron vs. Pro vs. consolidar) muda o que este workflow deve ser.
