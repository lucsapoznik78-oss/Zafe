# Os 19 crons estão registrados e nunca disparam

**Data da apuração:** 2026-07-31
**Severidade:** alta — é o que fecha, resolve e paga mercado
**Origem:** T11 do plano de rate limiting; virou o achado de maior impacto da rodada

## O que foi verificado

Os crons **existem e estão habilitados** na Vercel. `GET /v9/projects/{id}`
devolve `crons.enabledAt = 2026-03-31`, `crons.disabledAt = null` e as 19
definições completas, iguais ao `vercel.json`. `CRON_SECRET` está presente em
Production há 122 dias. Ou seja: não é o incidente de 2026-06-15 se repetindo.

O que não existe é **execução**.

### Sondas no banco

Tabelas escritas exclusivamente por um cron, sem nenhum outro caminho de escrita:

| Sonda | Cron | Agenda | Estado |
|---|---|---|---|
| `ranking_positions` | `ranking-delta` | `30 5 * * *` | **0 linhas**, rota no ar desde 2026-07-07 (24 dias) |
| `community_snapshots` | `comunidade-snapshots` | `0 1 * * *` | última escrita **2026-06-15 15:17 UTC** (46 dias), 8 dias distintos, nenhum às 01:00 |
| `topics.resolved_at` | `resolver-oracle` | `0 13 * * *` | 3 dias em 14, às 16:58 / 14:05 / 14:42 — nunca às 13:00 |
| `topic_insights` | `gerar-insights` | `0 0 * * *` | escritas às 21:57, 23:09, 14:22, 15:04 — nunca à meia-noite |

Os horários espalhados são a assinatura de execução manual/sob demanda. Nenhuma
escrita cai na janela de nenhum cron.

### O código está certo

`ranking-delta` disparado à mão com o `CRON_SECRET` real:

```
POST https://www.zafe.app.br/api/cron/ranking-delta
→ 200 {"success":true,"notified":0,"ranked":22}
```

22 linhas gravadas em `ranking_positions` em segundos. A tabela estava vazia
havia 24 dias com 22 usuários e 95 palpites elegíveis o tempo todo — o único
caminho de saída silenciosa da rota (`ranked.length === 0`) nunca foi o caso.
**Não é bug de rota. É o gatilho.**

## Duas causas prováveis, ambas do plano Hobby

Conta `lucsapoznik78-8723's projects`, `billing.plan = "hobby"` (confirmado via API).

1. **Limite de cron jobs do Hobby.** O plano permite um punhado de crons com
   disparo diário aproximado; o `vercel.json` declara 19, incluindo dois
   semanais (`bonus-semanal`, `resumo-semanal`). Excedido o teto, a Vercel
   registra as definições mas não as executa — que é exatamente o quadro
   observado (registrado + habilitado + zero execução).

2. **Deployment Protection nas URLs de deployment.**
   `ssoProtection = { deploymentType: "all_except_custom_domains" }`. As
   definições de cron apontam para
   `zafe-fd2sdp39s-…vercel.app` (host de deployment, não o domínio), e essa URL
   responde **302 para `vercel.com/sso-api`**:

   ```
   curl https://zafe-3eu6pnyko-…vercel.app/api/cron/ranking-delta
   → 302  location: https://vercel.com/sso-api?url=…
   ```

   O domínio próprio não é protegido — `www.zafe.app.br` devolve 403 corretamente
   (auth da rota funcionando). Só a URL que o cron usa está atrás do SSO.

O painel Vercel → Project → Cron Jobs mostra "Last run"/"Next run" por cron e
decide entre as duas em uma olhada. Vale conferir antes de agir.

## Correções possíveis

**A — pg_cron + pg_net no Supabase (recomendada, sem upgrade).**
As duas extensões estão disponíveis no projeto (`pg_cron 1.6.4`, `pg_net 0.20.0`,
nenhuma instalada). Agendar as 19 chamadas no Postgres, batendo em
`https://www.zafe.app.br/api/cron/*` com o `Authorization: Bearer <CRON_SECRET>`.
Resolve as duas causas de uma vez: não há teto de agendamentos e o domínio
próprio não passa pelo SSO. Custo: o `CRON_SECRET` passa a viver também no banco
(usar Vault, não texto puro em `cron.job`), e a agenda deixa de ser versionada
no `vercel.json` — precisa virar migration para não sumir do repositório.

**B — Upgrade para Pro.** Destrava o teto de crons e a granularidade da agenda.
Não resolve sozinho a hipótese 2; se o SSO for a causa, ainda precisa da
"Protection Bypass for Automation".

**C — Reduzir para caber no Hobby.** Consolidar os 19 num despachante único
diário que chama as tarefas em sequência. Barato, mas amontoa tudo num horário
só e um erro no meio derruba o resto.

## O plano B também está quebrado

`.github/workflows/cron.yml` existe justamente como escotilha manual
(`workflow_dispatch` only — o `schedule:` foi removido de propósito, porque dois
agendadores causavam payout duplo). Mas os 6 `curl` apontam para
`https://zafe-rho.vercel.app/...`, um alias que hoje devolve **404**.

Então não é só o gatilho automático: o jeito de disparar à mão pelo GitHub
também não funciona. Trocar por `https://www.zafe.app.br` é uma linha por step —
não foi feito aqui porque a escolha entre A, B e C muda o que este workflow deve
ser. Registrado em `ISSUES-ABERTAS.md`.

## O que fica pendente independentemente da correção

O incidente de 2026-06-15 (`AUDIT-REPORT2.md`) foi `CRON_SECRET` ausente
deixando os 21 crons em 401 **por semanas, sem ninguém notar**. Agora foi o
gatilho, também por semanas, também sem ninguém notar. O padrão não é a causa —
é a **ausência de alarme**. Qualquer que seja a correção escolhida, falta uma
sonda que grite quando um cron não escreve há mais de 48h.

## Nota sobre o fallback de sessão admin (a pergunta original do T11)

Das 19 rotas, 6 aceitam **ou** `Bearer CRON_SECRET` **ou** `profiles.is_admin`:
`resolver-oracle`, `bonus-semanal`, `fechar-mercados`, `finalizar-concurso`,
`games-resolver`, `saneamento-fantasy`, `atualizar-ranking-concurso`,
`criar-concurso-mensal`. As demais usam só `verifyCronAuth`. Quatro delas
(`fechar-mercados`, `bonus-semanal`, `resolver-oracle`) inlinam a comparação em
vez de usar o helper.

`grep` em `components/`, `app/admin/` e `lib/` por `fetch("/api/cron/…")`:
**nenhuma tela dispara cron**. O fallback é conveniência de desenvolvimento, não
funcionalidade de produto — e é o que tornou possível manter os crons vivos à
mão enquanto o gatilho estava morto.

Recomendação: **manter por ora**, remover depois que a correção A/B/C estiver de
pé e comprovada. Removê-lo agora tira o único jeito de rodar as tarefas.
Quando remover, padronizar as 19 em `verifyCronAuth`.
