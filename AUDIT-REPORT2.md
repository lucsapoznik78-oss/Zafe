# Zafe Audit Report 2 — Re-audited 2026-06-03 · **+ code sweep 2026-06-10 (`N1–N24`, see first section)**

Original supplementary audit: 2026-05-31 (14 agents). **Re-run 2026-06-03 with all 25 agents** in `agents/` (incl. new `zafe-crosscheck` and `zafe-validity`). Each agent cross-checked its domain's original items against the **current code** (post commits `c5846d1` "resolve all critical" and `842f246` "resolve all HIGH") and added new findings.

Legend: ✅ RESOLVED · 🟡 PARTIAL · ⛔ STILL OPEN · `[NEW]` = found in this re-audit.

> **CRITICAL fix pass — 2026-06-03:** All CRITICAL items are now resolved **except #7** (key rotation — user declined this session). Done: **C1–C8** + originals **#4, #5, #6**. See each item below for the fix. Two follow-ups required by you: **(1)** apply migrations `005`, `020`, `021` to the live DB (all additive/idempotent); **(2)** rotate the leaked keys for #7. Residual schema gap: the `desafios` parent table (flagged in `021`).

---

## 🆕 RE-AUDIT 2026-06-10 — 10 agents, code-only sweep (NEW findings `N1–N24`)

> ✅ **Fix pass 2026-06-11 (todos os CRITICAL e HIGH em aberto, exceto #7/H14/H1/H5 — ver nota):** N1–N12 + N18/N19 (bundled MEDIUMs), H3/H4, H13-residual, #13, #21, #31 (mitigação), #32. Migrations novas: `029`–`036`. **2026-06-11 deploy aplicado (build+testes OK, commit a277f4c, push, Vercel deploy).** Pendente: aplicar migrations 029–036 no SQL Editor do Supabase (ver `supabase/migrations/_apply_029_036.sql`). Ficam abertos por decisão/ação do dono: **#7** (rotação de chaves — usuário declinou nesta sessão), **H14** (env vars de deploy — ação manual do dono no Vercel), **H1-residual** (semântica allies-pairing — decisão de compliance/produto), **H5-residual** (HttpOnly exige mover escrita de cookies para o servidor — trabalho separado), **#10-residual** (CI gate + testes de wallet/payout), **#16-residual** e demais MEDIUM/LOW.

> Agents run: qa, security, db, compliance, wallet, liga(+grupos), economico(+odds), privadas, concurso, api+resolver. Each cross-checked against this report; only NEW items listed. **Confirmed still open, no regression:** H3 (executeTrade non-atomic), H4 (SELL over-sell), H1 residuals, #47, #85, payload-vs-data drift, validacaoAI fail-open, salvarResolucao swallow. **Confirmed fixed & holding:** C1–C8, H2/H6/H8/H9, #23 (recusar now validates), 18+ gate, admin-concurso queries (5084925/2d0e182), multi-outcome chart (be0a2c1).

### 🔴 CRITICAL
- ~~**N1 — `bet_status` enum missing `'exited'`.**~~ ✅ **FIXED 2026-06-11** — migration `029_fix_bet_status_notification_enums.sql` adds `'exited'` to `bet_status` (+ `'trade_executed'` to `notification_type`, N3). (db, economico.)
- ~~**N2 — RLS absent on 11 tables.**~~ ✅ **FIXED 2026-06-11** — migration `030_rls_concurso_community_constraints.sql` enables RLS + policies on all 12 tables (incl. `concursos`): public-content reads anon+auth (`concursos`, `community_events/_snapshots`, `creator_reputation`), owner-scoped reads (`inscricoes_concurso`, `concurso_wallets`, `concurso_bets`, `desafio_bets`), authenticated reads (`community_bets/_contestations`), owner CRUD where the app uses the user client (`push_subscriptions`, `referrals` — verified call sites). Writes stay service-role-only (no policy = denied). (db, security, concurso.)

### ⛔🟠 HIGH
- ~~**N3 — `notification_type` enum missing `'trade_executed'`.**~~ ✅ **FIXED 2026-06-11** — migration `029` (with N1). (db.)
- ~~**N4 — Duplicate migration numbers `020_*` and `021_*` (×2 each).**~~ ✅ **FIXED 2026-06-11** — seed files renamed `020b_eventos_simples_copa_junho_2026.sql` / `021b_remove_duplicatas_novos_eventos.sql` (`git mv`; `_` sorts before `b`, so they now replay after the enum fixes). No code referenced the old names. (db, migration.)
- ~~**N5 — `concurso_wallets.balance` has no `CHECK (balance >= 0)`.**~~ ✅ **FIXED 2026-06-11** — migration `030` adds the constraint (idempotent DO block). (db, wallet.)
- ~~**N6 — `inscrever`/`reentrar` non-atomic + CPF TOCTOU.**~~ ✅ **FIXED 2026-06-11** — migration `031_concurso_inscrever_atomic.sql` adds RPC `concurso_inscrever` (SECURITY DEFINER, service-role-only): revalida concurso ativo+período, insere inscrição + carteira na MESMA transação (`ON CONFLICT DO NOTHING` → `already_enrolled`). Both routes rewired to the RPC; pre-check SELECTs removed. (qa, concurso.)
- ~~**N7 — `saldo_inicial` not written at inscription.**~~ ✅ **FIXED 2026-06-11** — `concurso_inscrever` writes `saldo_inicial` from the contest row in the same insert. (concurso.)
- ~~**N8 — `amigos/convidar-aposta` missing amount validation.**~~ ✅ **FIXED 2026-06-11** — `amount` coerced with `Number()` and rejected unless `Number.isFinite && > 0` (same guard as H8); validated value used in balance check, insert and notification. (security, social.)
- ~~**N9 — Privadas double-accept race.**~~ ✅ **FIXED 2026-06-11** — atomic claim: guarded UPDATE `invited → accepted` with checked `.select()` row count (loser of the race gets 0 rows → 400 "Convite já processado"); downstream failures (saldo, limite anual, débito) revert the claim before returning. (privadas, wallet.)
- ~~**N10 — Privadas vote lands after round closes.**~~ ✅ **FIXED 2026-06-11** — migration `032_judge_vote_atomic.sql` adds RPC `registrar_voto_juiz`: single UPDATE with `voted_at IS NULL` + fase + `judge_vote_deadline > NOW()` no WHERE — um voto correndo contra `fecharVotacao` não é gravado após a apuração. Route rewired. (privadas.)
- ~~**N11 — Judge can resolve simple-model bolão prematurely.**~~ ✅ **FIXED 2026-06-11** — `votar-resultado` now requires `status === "active"` AND `closes_at <= now` before resolving. (privadas, resolver.)
- ~~**N12 — Forbidden vocabulary "sacar"/"saque" in user-facing copy.**~~ ✅ **FIXED 2026-06-11** — `CpfForm.tsx` → "Para receber prêmios, precisamos verificar seu CPF…"; `PorQueConfiar.tsx` → "Prêmios pagos automaticamente, sem taxas…". Zero remaining "sacar/saque" matches in app/components/lib. (compliance.)

### ⛔🟡 MEDIUM
- **N13 — `min_bet` accepts negatives.** `app/api/criar/route.ts:54` — `parseFloat(min_bet) || 1` lets `-50` through (only NaN falls back). Fix: reject non-finite or ≤ 0. (security, api.)
- **N14 — `ligas/aceitar` no pending-status guard.** `route.ts:11-15` updates to `active` without `.eq("status","pending")` — accept is replayable; harmless today but fragile if side-effects are added. (liga.)
- **N15 — Over-permissive `liga_members` INSERT policy still active.** `003_ligas.sql:55` allows any authed user to insert any row (`WITH CHECK auth.uid() IS NOT NULL`); 018's tighter policies OR with it, so it silently carries the whole invite flow. Dropping it without a creator-invite policy breaks `convidar`. Fix: add explicit `is_liga_creator` invite policy, then drop the 003 one. (liga, db.)
- **N16 — Missing UUID validation on invite ids.** `amigos/convidar-aposta` (`invitee_id`), `ligas/convidar` (`friend_id`), `apostas-privadas/[id]/convidar` (`user_id`) — none validate UUID format/existence before insert (contrast `amigos/bloquear` post-H6). FK errors can leak schema details. Fix: UUID regex + profile existence check. (api, security.)
- **N17 — Economia oracle number parsing assumes pt-BR.** `lib/oracles/economia.ts:21,152,227` — `.replace(".","").replace(",",".")` mangles English-format targets ("1.5" → 15) extracted from titles → wrong threshold comparison → wrong auto-resolution. Fix: detect separator format before normalizing. (economico, resolver.)
- ~~**N18 — `reentrar` returns wrong balance.**~~ ✅ **FIXED 2026-06-11** — `concurso_inscrever` RPC (migration `031`) returns the REAL `concurso_wallets.balance` on `already_enrolled`; route passes it through. (qa, concurso.)
- ~~**N19 — `concurso_wallets` lacks `version` column.**~~ ✅ **FIXED 2026-06-11** — migration `030` adds `version INTEGER NOT NULL DEFAULT 0` + trigger `trg_bump_concurso_wallet_version` reusing `bump_wallet_version()` (023). (db, wallet.)
- **N20 — Privadas friendship/block check also absent in `apostas-privadas` convidar/aceitar** (extends the known amigos-route item): anyone can be invited to a "private bet between friends", including users who blocked the inviter. (privadas, social.)
- **N21 — Metadata brands the product "Fantasy Game".** `app/layout.tsx:12,15,28-36,75` — defensible (Cartola precedent) but inconsistent with preferred "liga de previsões / competição de habilidade"; user-facing via titles/OG. Owner call. (compliance.)

### ⛔🔵 LOW
- **N22 — `ligas/convidar` re-invite after decline creates a second `liga_members` row** (declined + pending coexist; UNIQUE catch only stops exact dups). Fix: upsert / clean declined rows first. (liga.)
- **N23 — Privadas refusal/timeout audit trail weak.** `recusar` deletes the participant row with no record; judge-timeout refunds don't record a reason ("juízes não votaram" vs "sem consenso"). UX/auditability only. (privadas.)
- **N24 — Concurso bookkeeping niggles.** `atualizar-ranking-concurso/route.ts:64-71` maintains denormalized `saldo_atual`/`posicao_atual` nothing reads; `pagarBonusPioneiroConcurso` (`lib/concurso-payout.ts:29`) intentionally credits the **main Z$** wallet — correct but undocumented, add a comment. (concurso.)

### Recommended order
1. **N1 + N3** — one migration adding both enum values (order book is currently broken).
2. **N2 + N5 + N19** — RLS + constraints migration for concurso/community tables.
3. **N6 + N7 + N18** — atomic inscription RPC, correct `saldo_inicial`/balance.
4. **N8 + N9 + N10 + N11** — money-path validation/races (privadas + amigos).
5. **N12** — copy fix (two strings, five minutes, real legal exposure).
6. **N4** — renumber migrations before the next fresh-DB replay.
7. Rest as convenient.

---

## 🔴 EVENT INTEGRITY SWEEP — 2026-06-07 (zafe-dates + zafe-validity + zafe-crosscheck, LIVE DB)

> Re-run of the three event-integrity agents **against the live Supabase DB** (`mhckuhqyyfoapzgrqeco`), whole site, all 86 active events. **Today = 2026-06-07.** Per request, all findings below are classified **CRITICAL** — they are user-facing events that are unresolvable, impossible, expired, or duplicated and can still take real palpites. No DELETEs proposed; cancel via `status='cancelled'` only after confirming 0 bets.
>
> **Real-world facts verified by web search (sources at end):**
> - **World Cup 2026:** opener **June 11** (Mexico × South Africa); **Brazil estreia June 13** vs Morocco (Group C: Morocco/Scotland/Haiti); **group stage ends June 27**; Round of 32 **June 28–July 3**; oitavas/R16 **July 4–7**.
> - **Brasileirão:** paused after round 18 (May 30/31) for the World Cup, resumes **~July 22** → **no club-league games in June**. Table frozen with **Palmeiras** leading (not Flamengo).
> - **Palmeiras × Corinthians (Dérbi):** already played **April 12, 2026** (0×0) — no June rematch.
> - **Libertadores:** **Botafogo is NOT** among the 6 Brazilian clubs in the R16 (Corinthians, Cruzeiro, Flamengo, Fluminense, Mirassol, Palmeiras); oitavas games **Aug 11–20**.
> - **Neymar:** convocated for World Cup 2026 (outcome effectively known).

### 🔴 zafe-dates — market closes AFTER / too close to the real event (unresolvable or exploitable)

| ID | Title | closes_at | Event | Problem |
|----|-------|-----------|-------|---------|
| `3fd41760` | O jogo de abertura da Copa terá mais de 2 gols? | **2026-06-12** | match **June 11** | **CRITICAL** — closes the day AFTER the match → result already known while still open. |
| `efdf8015` | O Brasil vai vencer o jogo de estreia na Copa? | **2026-06-14** | Brazil estreia **June 13** | **CRITICAL** — closes the day AFTER the match → exploitable. |
| `b676b1ed` | O Brasil vai terminar a fase de grupos em primeiro lugar? | **2026-06-28** | group stage ends **June 27** | **CRITICAL** — closes after the standings are final. |
| `1bc9a369` | O Brasil vai se classificar para as oitavas? | **2026-06-28** | R16 is **July 4–7** (after R32 June 28–Jul 3) | **CRITICAL** — close date predates the "oitavas" round in the 2026 (48-team) format; cannot be resolved at close. |

### 🔴 zafe-validity — events that are impossible / reference matches that do not exist

| ID | Module | Title | closes_at | Why impossible |
|----|--------|-------|-----------|----------------|
| `eed2c06a` | concurso/liga | O Palmeiras vai vencer o Dérbi contra o Corinthians? | 2026-06-15 | **No June Dérbi** — Brasileirão paused for WC; Derby was April 12 (0×0). Unresolvable. |
| `c7f57907` | liga | O Corinthians vai se classificar no dia 15/06? | (vague) | **No fixture** on 15/06 (league paused); title is vague/unresolvable. |
| `dbc19f36` | liga | O Flamengo vai vencer o próximo clássico contra o Fluminense? | 2026-06-30 | **No Fla-Flu in June** (league paused). Unresolvable. |
| `2eb94b7c` | liga | O Botafogo vai se classificar nas oitavas da Libertadores? | 2026-06-25 | **Botafogo not in R16**; oitavas only Aug 11–20. Impossible / already settled NÃO. |
| `7dd0da5c` | concurso | O Flamengo vai liderar o Brasileirão ao fim de junho? | 2026-06-30 | Table **frozen at round 18 with Palmeiras leading** → answer is effectively NÃO; misleading. |
| `175dd801` | liga | Neymar vai estar na Copa do Mundo 2026? | 2026-07-01 | **Known YES** (convocated) — degenerate market, no uncertainty. |
| `9bc72a4e` | privada | Volpato vai fail 3 ou mais provas? | **2026-05-28** | **Expired 10 days ago**, still `active`. Broken title + overdue. |

### 🔴 zafe-crosscheck — duplicate / overlapping / contradictory events (live DB)

- **Bitcoin cluster (cross-module):** concurso `ba600b40` (BTC > US$120k, Jun 30) ≈ economico `5ac49b90` (same, semantic dup) + BRL variant `e479fa07` ("R$600.000") + `145ac793` ("US$100.000 este mês"). Multiple near-identical BTC markets resolving on the same window.
- **Ethereum near-dup:** concurso `66c54f4b` (ETH > US$4.000, June) vs economico `95a3daff` (same threshold, July) — overlapping.
- **Selic / COPOM June (contradictory, should be one binary):** concurso `f90cd56c` ("manter") vs economico `f75a6e0e` ("reduzida") vs economico `9f45f274` ("cortar > 0,25%") — three overlapping/contradictory markets on the same COPOM decision.
- **Dólar / Real June-close cluster (overlapping bands):** `dba2d25c` (dólar < R$5,50), `c4618477` (real valoriza), `cdac9fe7` (dólar PTAX > R$5,90), `53bc9ebe` (real < R$5,80) — overlapping/contradictory ranges.
- **Reforma tributária (cross-module overlap):** concurso `87060824` ("regulamentação… sair") vs liga `5cd40629` ("aprovar no Congresso") — same underlying event, two markets.

### Action (report-only — confirm bet/volume before any change)
1. **zafe-dates (4):** extend `closes_at` to **before** the real event start (e.g. opener → 2026-06-10 23:59; Brazil estreia → 2026-06-12 23:59; group-stage/first-place → 2026-06-26 23:59; classificação oitavas → after R32, ~2026-07-03) **or** cancel if 0 bets.
2. **zafe-validity (7):** cancel the impossible matchups (`eed2c06a`, `c7f57907`, `dbc19f36`, `2eb94b7c`) and the expired `9bc72a4e`; review degenerate/misleading (`175dd801`, `7dd0da5c`) — owner decision if they carry bets.
3. **zafe-crosscheck:** consolidate the BTC/ETH/Selic/Dólar/Reforma clusters into single binaries; model COPOM as one decision.
4. **Root cause (still open):** no creation/replication-time validation (close_date < event start, matchup exists, dedup) — `replicar-topics` keeps re-publishing template events that reference non-existent fixtures. This is the recurring source.

### ✅ RESOLUÇÃO — 2026-06-07 (LIVE DB, todos os alvos tinham 0 palpites e 0 ordens, exceto Volpato)
- **zafe-dates — corrigidos (extend `closes_at`):** `3fd41760` → 11/06 02:59Z (10/06 23:59 BRT, antes da abertura), `efdf8015` → 13/06 02:59Z (12/06 BRT, antes da estreia), `b676b1ed` → 27/06 02:59Z (26/06 BRT, antes do fim dos grupos). `1bc9a369` ("classificar oitavas") **cancelado** — irresolvível no formato 48 (grupo→R32→R16), o fechamento não casa com a rodada.
- **zafe-validity — cancelados (`status='cancelled'`):** `eed2c06a` (Dérbi junho), `c7f57907` (Corinthians 15/06), `dbc19f36` (Fla×Flu junho), `2eb94b7c` (Botafogo Libertadores), `7dd0da5c` (Flamengo líder — enganoso), `175dd801` (Neymar — YES conhecido/degenerado). Total cancelado nesta passada: **7** (inclui `1bc9a369`).
- ⛔ **`9bc72a4e` (Volpato, privada, EXPIRADO 28/05, 1 palpite)** — NÃO cancelado: carrega aposta real; cancelar exige reembolso pelo fluxo correto (conservação Z$, regra 4). **Decisão do dono.**
- 🟡 **zafe-crosscheck (BTC/ETH/Selic/Dólar/Reforma):** NÃO consolidados — são clusters cross-module/contraditórios que resolvem normalmente cada um por si; consolidar é decisão de produto (qual manter). Todos com 0 palpites. **Flagged p/ dono.**
- ✅ **Root cause documentado:** novo `docs/CRIAR-EVENTO.md` (checklist obrigatório: data antes do desfecho, evento existe/possível, dedup cross-module, nunca DELETE em prod) + regra 7 no CLAUDE.md. Validação automática na criação/replicação **ainda aberta no código**.

**Sources:** FIFA / Wikipédia (WC 2026 schedule & Brazil Group C), ge.globo / CBF (Brasileirão WC pause, table at round 18), CONMEBOL / Olympics.com (Libertadores R16 clubs & Aug dates), CNN/ge (Palmeiras×Corinthians Apr 12), ge/CBF (Neymar convocation).

---

## Cross-check summary

- **Original items: 96.** Resolved: **17** · Partially resolved: **6** · Still open: **73**.
- **New issues found this round: ~40** (incl. 8 new CRITICAL).
- Headline: the CAS/double-spend, auth, and limit fixes from the original CRITICAL list **landed and verified** for the *main Z$ wallet* — but the **contest (ZC$) wallet has the exact same silent-CAS double-spend** that was never fixed, several **DB enum/column mismatches now throw at runtime**, the **Vercel cron config is non-functional (GET vs POST)** with a **second GitHub-Actions scheduler double-firing** non-idempotent payouts, and the **migration set still cannot reproduce the schema** (missing tables + missing migration 005). **→ All of these CRITICALs are now fixed (2026-06-03); see the CRITICAL section.**

---

## ✅ RESOLVED since 2026-05-31 (crossed off)

- ~~**1.** Silent double-spend on main bet route~~ ✅ `lib/wallet.ts:41-52` `adjustBalance` now does `.eq("balance", current).select("balance")` + checks `updated.length > 0`; `lib/apostar.ts:73` routes through it.
- ~~**2.** Silent double-spend in community bets~~ ✅ `lib/comunidade.ts:116,136` use `debitBalance`/`creditBalance`.
- ~~**3.** Contest replicar-topics zero auth~~ ✅ `app/api/concurso/replicar-topics/route.ts:5-10` now requires `getUser()` + `is_admin`.
- ~~**8.** 5.000 Z$/year private limit dead code~~ ✅ `verificarLimiteAnual` wired into `apostas-privadas/criar/route.ts:46-51` and `[id]/aceitar/route.ts:46`. (But see NEW bypasses below.)
- ~~**9.** Liga ranking reads non-existent column~~ ✅ `app/api/ligas/ranking/route.ts:37,48` now `potential_payout`.
- ~~**17.** Weekly bonus can erase balances~~ ✅ `cron/bonus-semanal/route.ts:37-44` per-wallet `creditBalance` CAS, no snapshot-overwrite.
- ~~**19.** "Clean duplicates" always 401~~ ✅ `admin/limpar-duplicados/route.ts:8-23` dual-path (CRON_SECRET or admin session).
- ~~**28.** Self-bet in Privadas~~ ✅ `apostas-privadas/criar/route.ts:32-37` rejects creator in adversário/aliado/judge.
- ~~**42.** Duplicate route trees~~ ✅ `/apostas-privadas/*` are now redirect stubs to `/privadas/*`.
- ~~**51.** Silent CAS bug in Econômico~~ ✅ `executePalpitar` → `debitBalance` CAS.
- ~~**56.** Negative bet amount in Privadas~~ ✅ `apostas-privadas/criar/route.ts:25-29` rejects `betAmount <= 0`.
- ~~**58.** Cancel private bet race~~ ✅ `apostas-privadas/[id]/cancelar/route.ts:45` uses `creditBalance`.

**🟡 Partially resolved (do not re-open fully, but residual remains):**
- **16.** 18/28 wallet sites no lock → ✅ main-Z$ paths now CAS, ⛔ `concurso_wallets` + `comunidade/contestar` still raw (see #16-residual / NEW C2).
- **22.** Hardcoded creator UUID → 🟡 `repor-eventos-expirados/route.ts:75,135` reads `SYSTEM_USER_ID` but **falls back to the literal UUID and the env var is unset** → literal still active.
- **23.** Decline always returns success → ✅ new `apostas-privadas/[id]/recusar` checks status; ⛔ **legacy `amigos/recusar-aposta/route.ts:9-17` still has the bug** (no validation, always `success:true`).
- **24.** 5 routes leak raw errors → ✅ 4 fixed; ⛔ `concurso/replicar-topics/route.ts:67` still returns `error.message`.
- **62.** Wrong tx type for weekly bonus → 🟡 changed to `"weekly_bonus"`, **but that value is not in the `transaction_type` enum** → now throws (NEW C3).
- **92.** Mark-read should be PATCH → ✅ per-id `notificacoes/[id]/route.ts` is PATCH; ⛔ bulk `notificacoes/route.ts:19` still POST.

---

## ⛔🔴 CRITICAL (open)

### New this round
- ~~**C1 `[NEW]` — ZC$ contest double-spend (silent CAS).**~~ ✅ **FIXED 2026-06-03.** Added `adjustConcursoBalance`/`debitConcursoBalance`/`creditConcursoBalance` CAS helpers to `lib/wallet.ts` (optimistic lock on `concurso_wallets`, keyed by user_id+concurso_id, with checked `.select()` row count). Rewired `concurso/palpitar/route.ts` to debit via `debitConcursoBalance` (checked `!debit.ok` → 400) and roll back via relative `creditConcursoBalance`.
- ~~**C2 `[NEW]` — `concurso_wallets` payout + `comunidade/contestar` use raw read-modify-write (no CAS).**~~ ✅ **FIXED 2026-06-03.** `lib/concurso-payout.ts` cancel-refund + both winner-payout loops (binary + multi) now credit through `creditConcursoBalance` (CAS). `comunidade/[id]/contestar/route.ts` fee charge now debits through `debitBalance` (CAS) with checked result.
- ~~**C3 `[NEW]` — DB enum mismatches throw at runtime.**~~ ✅ **FIXED 2026-06-03.** New migration `020_fix_enums_and_notifications.sql` adds `weekly_bonus` to `transaction_type` and `bonus`/`market_closing`/`watchlist_alert` to `notification_type` (all `ADD VALUE IF NOT EXISTS`). Code fix: `apostas-privadas/[id]/cancelar/route.ts` now inserts the existing `bet_refund` instead of the undefined `refund`.
- ~~**C4 `[NEW]` — Notification schema mismatch silently drops social notifications.**~~ ✅ **FIXED 2026-06-03.** Migration `020` adds `title TEXT`, `body TEXT`, `data JSONB` columns to `notifications` (additive, nullable, `payload` retained) — matching the `title`/`body`/`data` shape the ~28 call sites already write.
- ~~**C5 `[NEW]` — Vercel crons are non-functional (GET vs POST).**~~ ✅ **FIXED 2026-06-03.** Added `export const GET = POST;` alias to all 11 POST-only cron routes (`resolver-oracle`, `fechar-mercados`, `bonus-semanal`, `apostas-privadas-timeout`, `finalizar-concurso`, `atualizar-ranking-concurso`, `news-agent`, `comunidade-fechar/-abandonados/-contestacoes/-snapshots`) — function declarations are hoisted so the alias is safe. The other 3 (`repor-mercados`, `repor-eventos-expirados`, `match-orders`) already export GET. All 14 Vercel crons now reach a handler instead of 405.
- ~~**C6 `[NEW]` — Dual cron schedulers double-fire non-idempotent payouts.**~~ ✅ **FIXED 2026-06-03.** Vercel Crons (`vercel.json`, per-job schedules) are now the single production scheduler. `.github/workflows/cron.yml` reduced to `workflow_dispatch` only (manual fallback); its automatic `schedule:` triggers (which also ran hourly) were removed, eliminating the double-fire. (Idempotency lock — #63 / C7 — still recommended as defense-in-depth.)
- ~~**C7 `[NEW]` — Double-resolution race → double-pay.**~~ ✅ **FIXED 2026-06-03.** Added `claimTopicForResolution()` to `lib/payout.ts`: atomically flips the topic out of any non-terminal status to `resolved` (`.not("status","in",'("resolved","cancelled")')`) and confirms via `.select()` that this caller changed the row — the loser of the race gets 0 rows and returns `{note:"already_resolved"}` before paying. Wired into `pagarVencedores`, `pagarVencedoresMulti`, and `reembolsarTodos` (the last takes an `alreadyClaimed` flag so the internal no-coverage refund path doesn't re-claim). Verified both callers (`admin/resolver-direto`, `cron/resolver-oracle`→`lib/oracles`) invoke these while the topic is still `resolving`, so the first caller wins the claim.
- ~~**C8 `[NEW]` — Migration 005 missing + `concursos` FK hard-fails clean DB.**~~ ✅ **FIXED 2026-06-03.** New `005_concurso_core.sql` creates `concursos`, `inscricoes_concurso`, `concurso_wallets`, `concurso_bets` (all `IF NOT EXISTS`, columns reconstructed from the routes that read/write them) — runs before `010`, so the `topics.concurso_id → concursos(id)` FK and the `v_concurso_*` views resolve on a fresh DB. No-op on prod.

### Original CRITICAL still open
- ~~**⛔ 4.**~~ ✅ **FIXED 2026-06-03.** `005_concurso_core.sql` (concurso tables) + `021_missing_tables.sql` (community: `community_events`/`_bets`/`_contestations`/`_snapshots` + `creator_reputation` + `v_community_event_stats`; plus `push_subscriptions`, `referrals`, `desafio_bets`). All `IF NOT EXISTS` → idempotent on prod, reproducible from zero. ⚠️ Residual: the **`desafios` parent table** could not be reconstructed from code (no creation route/DDL found) — `desafio_bets.desafio_id` left FK-less and flagged in `021` for manual validation against prod.
- ~~**⛔ 5.**~~ ✅ **FIXED 2026-06-03.** Renamed `008_private_bets.sql` → `008b_private_bets.sql` (distinct version, still sorts after `008_order_book.sql`). No code referenced the old filename.
- ~~**⛔ 6.**~~ ✅ **FIXED 2026-06-03.** Added `is_public BOOLEAN DEFAULT false` and `parent_liga_id UUID REFERENCES ligas(id)` to the `ligas` CREATE TABLE in `003_ligas.sql`, so the `is_liga_public` function + `ligas_subliga_member_read` policy in `018` resolve on a fresh DB.
- **⛔ 7.** Service role key — **WORSE**: `.env.local` is gitignored but contains a **live `service_role` JWT (exp 2090), live `VAPID_PRIVATE_KEY`, live `FIRECRAWL_API_KEY`**; `scripts/seed-eventos.mjs:3-4` **hardcodes the service_role key in committed code** (violates rule 2). Rotate. (deploy, crosscheck, validity, content, liga.) — **User declined key rotation this session; left open.**

---

## ⛔🟠 HIGH (open)

### New this round
- **🟡 H1 `[NEW]` — Annual-limit bypasses (CMN 5.298).** ✅ PARTIAL 2026-06-05: (57) switched `getVolumeAnualPar` to a rolling 365-day window (no more Jan-1 reset); (b) added an upfront limit pre-check in `convidar/route.ts` mirroring `/aceitar`. ⛔ RESIDUAL: (a) allies are still paired invitee↔creator (same-side) instead of vs the opposing side, and (c) the check→debit TOCTOU is still not atomic. Both need a Postgres function (advisory lock + single-statement check) **and** a compliance product decision on how to count pooled per-pair volume — not guessed at here. (privadas.)
- **⛔🟠 ~~H2~~** ✅ FIXED 2026-06-05 — `replicar-topics` now clones by column whitelist (content + oracle config) and resets all resolution state (`status/resolution/resolved_at/resolved_by/winning_outcome_id`, `liga_id`); no more `...topic` spread. (concurso.)
- ~~**H3 `[NEW]` — `executeTrade` is not atomic.**~~ ✅ **FIXED 2026-06-11** — migration `033_order_book_atomic.sql` adds RPC `execute_trade` (SECURITY DEFINER, service-role-only): registro do trade, crédito do vendedor, reembolso de escrow, baixa da posição (FOR UPDATE) e criação da posição do comprador numa ÚNICA transação Postgres. `lib/order-matching.ts` rewired; trades que falham não atualizam fills; notificações só após confirmação. (economico, odds.)
- ~~**H4 `[NEW]` — SELL orders still over-sellable.**~~ ✅ **FIXED 2026-06-11** — migration `033` adds RPC `create_sell_order`: lock da aposta-fonte (`FOR UPDATE`) + cálculo de disponibilidade + INSERT da ordem na mesma transação — SELLs concorrentes serializam. `topicos/[id]/ordem` SELL path rewired ao RPC com mapeamento de status. (economico.)
- **🟡 H5 `[NEW]` — Session cookie not HttpOnly/Secure.** ✅ FIXED 2026-06-07 (partial): `lib/supabase/client.ts` `setAll` now removes the misleading `httponly` token, forces `Secure` on HTTPS, and defaults `SameSite=Lax`. ⛔ RESIDUAL: HttpOnly genuinely cannot be set from `document.cookie` (browser ignores it) — the client SSR needs JS-readable cookies; true HttpOnly requires moving auth-cookie writes server-side (separate work). (auth, security.)
- **⛔🟠 ~~H6~~** ✅ FIXED 2026-06-05 — `buscar-usuarios` strips PostgREST-structural chars (`,()."*\%_`) from `q` before interpolating into `.or()`; `amigos/bloquear` now requires `blocked_id` to match a strict UUID regex before it reaches the `.or()` filter. (security, social.)
- ~~**H7 `[NEW]` — No 18+ age-gate.**~~ ✅ FIXED 2026-06-07 (revisado) — Menores PODEM usar Liga/Econômico/Privadas/Comunidade; o gate 18+ vale **apenas para o Concurso** (prêmio em R$ via PIX). `ConfirmarInscricao.tsx` exige data de nascimento e valida idade ≥ 18; `api/concurso/inscrever` revalida no servidor (403 se <18) e grava `profiles.birth_date` (migration `024`). Cadastro geral sem age-gate. (compliance, concurso.)
- **⛔🟠 ~~H8~~** ✅ FIXED 2026-06-05 — `amount` is now coerced with `Number()` and rejected unless `Number.isFinite && > 0` in `apostar`, `concurso/palpitar`, and `executeCommunityBet`; coercion at the top also stops string `amount` from corrupting pool arithmetic. (api.)
- **⛔🟠 ~~H9~~** ✅ FIXED 2026-06-05 — `BetForm` payout now uses true parimutuel `stake * (pool+stake)/(sidePool+stake)`, including the user's own stake in the denominator (pools 100/100 + bet 100 → Z$150, not Z$200). Dead odds vars/import removed. (odds.)
- **⛔🟠 ~~H10~~** ✅ FIXED 2026-06-05 — `aprovar` now debits the seeder's wallet (Z$2) via CAS before inserting the seed bets and records a `bet_placed` transaction; if balance is insufficient it activates the market without seeding. No more Z$ minted into the pool. ⛔ RESIDUAL: seed bets still sit on the admin's own account (a house/SYSTEM account excluded from payout — H14's `SYSTEM_USER_ID` — is the cleaner long-term design). (admin.)
- **⛔🟠 ~~H11~~** ✅ FIXED 2026-06-05 — "Ativos (30 dias)" now counts distinct users with ≥1 bet in the last 30 days (real activity proxy) instead of the non-existent `profiles.updated_at`. Proper `last_seen` instrumentation still absent (separate work). (analytics.)
- ~~**H12 `[NEW]` — `wallets` has no `version` column.**~~ ✅ FIXED 2026-06-07 — migration `023_wallet_version_and_reversal.sql` adds `wallets.version INT NOT NULL DEFAULT 0` + a `BEFORE UPDATE` trigger (`bump_wallet_version`) that increments it on any balance change. Applied to live DB. (db.)
- ~~**🟡 H13 `[NEW]` — `resolver-direto` verdict mapping.**~~ ✅ PARTIAL 2026-06-05: mixed topics now pay **both** `bets` and `concurso_bets` (counts each table, runs `pagarVencedores` first so its atomic C7 claim wins, then `pagarConcursoBets`) — no set left unpaid. ✅ **RESIDUAL FIXED 2026-06-11**: o prompt agora ecoa um código por evento (`[<uuid 8 chars>]`) e os vereditos são keyed por esse código (`{"id":"a1b2c3d4","resultado":...}`); ids desconhecidos são descartados com warning, e o "i" posicional só vale como fallback quando não há id — um modelo que renumera não paga o mercado errado. (resolver.)
- **H14 `[NEW]` — Deploy blockers:** `ANTHROPIC_API_KEY=sua_chave_aqui` placeholder in `.env.local:10`; `CRON_SECRET`/`SYSTEM_USER_ID` unset; cron cadence daily where #29/#30 require hourly. (deploy.)
- **🟡 H15 `[NEW]` — Eventos impossíveis/duplicados ativos em produção (`zafe-validity` nunca foi executado).** O agente `zafe-validity` só gera relatório e nunca rodou contra o banco; não há validação na criação de eventos nem no `replicar-topics`, então a replicação de templates do Concurso publicou eventos que se referem a partidas inexistentes e duplicatas intra-módulo. ✅ FIXED 2026-06-06: varredura dos 90 mercados ativos (data 2026-06-06), **6 eventos cancelados** (`status='cancelled'`, todos com 0 palpites e 0 ordens abertas — sem impacto em Z$):
  - **Impossíveis (partidas inexistentes):** "Brasil vencer a Argentina nas Eliminatórias" (`d1344a22`) e "Brasil vencer a Venezuela no dia 10/06" (`63725ad7`) — Eliminatórias CONMEBOL terminaram em 09/09/2025; "Brasil golear o Paraguai" (`3bb7eaa0`, fecha 18/06) — Brasil está no Grupo C da Copa (Marrocos/Escócia/Haiti, jogos 13/19/24-jun), não enfrenta o Paraguai.
  - **Duplicatas intra-módulo:** "Apple anunciará recurso de IA na WWDC… (fecha 30/06)" (`724b586c`) duplica `9e464885` (fecha 09/06, data correta da WWDC); "Flamengo terminará junho na liderança…" (`38b9e209`) duplica `7dd0da5c` (mesmo concurso/prazo); "Flamengo vai vencer a Libertadores este ano" (`cc7d77b8`, fecha 27/06 — final é em novembro, prazo impossível) duplica `685920b9` (fecha 01/12).
  - ⛔ RESIDUAL: (a) **causa-raiz não corrigida** — falta validação na criação/replicação de eventos (data ≥ desfecho real, matchup existente, dedup) para impedir que o problema reapareça; (b) 2 itens deixados para decisão do dono por terem palpites/serem privados: "Volpato vai fail 3 ou mais provas?" (`9bc72a4e` — título quebrado, privado, prazo vencido em 28/05, 1 palpite) e "Jesus vai voltar até o fim de 2026?" (`90af3e15` — conteúdo de baixa qualidade, mas prazo válido até 01/01/2027, 4 palpites). (validity, content, concurso.)

### Original HIGH still open
- **⛔ 10.** Zero test infrastructure — 🟡 PARTIAL 2026-06-10: vitest configurado (`vitest.config.ts`, `npm run test`) com 61 testes da engine da Copa (`lib/copa/__tests__/`). ⛔ RESIDUAL: sem CI gate; faltam testes de wallet CAS, order matching/escrow, conservação de payout e scoring do concurso. (tests.)
- ~~**⛔ 11.**~~ ✅ FIXED 2026-06-07 — `LoginForm` tem link "Esqueci minha senha" → `resetPasswordForEmail` (redirect via `/auth/confirm?next=/redefinir-senha`, que já trata `type=recovery`); nova página `/(auth)/redefinir-senha` define a nova senha via `updateUser`. (auth, security.)
- ~~**⛔ 12.**~~ 🟡 FIXED 2026-06-07 (mitigação) — `LoginForm` aplica rate-limit client-side: após 5 falhas, cooldown crescente (30s, dobra a cada falha, máx. 15min) via localStorage; limpa no login bem-sucedido. ⛔ RESIDUAL: sem rate-limit server-side dedicado nem captcha (o endpoint do Supabase tem o próprio limite). (auth, security.)
- ~~**⛔ 13.**~~ ✅ **FIXED 2026-06-11** — migration `034_profiles_2fa_columns.sql` adds `two_fa_enabled BOOLEAN NOT NULL DEFAULT false`, `two_fa_method TEXT CHECK (IN 'email','sms')`, `phone TEXT` to `profiles` (`IF NOT EXISTS` — no-op se prod já as tinha manualmente). (db, auth.)
- ~~**⛔ 14.**~~ ✅ FIXED 2026-06-07 — `middleware.ts` agora trata email não confirmado (`!user.email_confirmed_at`) como não autenticado para rotas protegidas (OAuth já vem confirmado); redireciona ao `/login`. (auth.)
- **🟡 15.** JWT exposed to XSS — session cookie JS-readable (see H5; Secure/SameSite agora aplicados, HttpOnly ainda pendente server-side). (auth, security.)
- **⛔ 16-residual.** `concurso_wallets` + `comunidade/contestar` lack optimistic lock (see C2). (wallet.)
- ~~**⛔ 18.**~~ ✅ FIXED 2026-06-07 — `reverterResolucao` agora estorna via novo helper `estornarPayout`: lê o saldo, faz clamp do clawback ao disponível, verifica o resultado do `debitBalance` (CAS) e **sempre** registra uma transação `type='reversal'` (novo valor no enum, migration `023`) com o déficit não coberto explícito na descrição + log de erro. Sem mais débito silencioso → conservação auditável. (resolver, wallet.)
- ~~**⛔ 21.**~~ ✅ **FIXED 2026-06-11** — migration `036_admin_user_management.sql` (`profiles.banned` + tx type `manual_adjustment`); middleware bloqueia banidos em rotas protegidas (403 em `/api/*`, redirect → `/banido`); novas rotas `/api/admin/usuarios` (busca + saldo), `/api/admin/usuarios/[id]` (GET carteira+transações, PATCH ban/unban com proteção contra auto-ban), `/api/admin/usuarios/[id]/ajustar` (ajuste manual via CAS `adjustBalance`, motivo obrigatório, transação auditável com admin em `reference_id`); UI em `/admin/usuarios`. (admin, db.)
- ~~**⛔ 31.**~~ 🟡 **FIXED 2026-06-11 (mitigação)** — migration `035_topic_stats_covering_index.sql`: índice cobridor `bets(topic_id) INCLUDE (side, status, amount)` → a agregação da view sai por index-only scan (todos os consumidores menos 2 filtram por `topic_id`, com pushdown do predicado). ⛔ RESIDUAL: materialização/denormalização adiada até a escala exigir. (perf, liga.)
- ~~**⛔ 32.**~~ ✅ **FIXED 2026-06-11** — `lib/payout.ts` em lote: crédito agregado por usuário (1 CAS por carteira, não por bet), updates de bets em paralelo controlado (`emLotes`, lotes de 10), perdedores num único `.update().in()`, transactions/notifications em bulk INSERT. ~1.200 chamadas num mercado de 500 bets → ~60. Aplicado a `pagarVencedores`, `pagarVencedoresMulti` e `reembolsarTodos` (novo `refundBets`). (resolver, perf.)

---

## ⛔🟡 MEDIUM (open)

Original still open: **25** (README/types/a11y/UX/feature gaps), **26** (no Sybil/CPF check in contest), **27** (no Regulamento do Concurso), **29** (bolão recruitment never advances real-time), **30** (cron daily vs 1h deadlines), **33** (README boilerplate), **34** (zero docs — now **83** routes undocumented), **35** (stale `TransactionType` + missing new types), **36** (zoom disabled WCAG 1.4.4), **37** (near-zero aria), **38** (liga detail no loading state — zero `loading.tsx` anywhere), **39** (188× `text-[9/10px]`), **40-residual** (avatar dropdown still `window.location.href`), **41** (orphan `/premium`,`/portfolio`), **43** (forbidden-terms filter client-only; `app/api/criar` has no server check), **44** (trending feed not implemented), **45** (`exited` bets counted in pool volume — view counts non-`refunded`), **46** (static `potential_payout` vs parimutuel), **47** (no tie-break liga ranking), **49** (AI oracle label match case-sensitive, `lib/oracles/index.ts:151`), **50** (snapshots once/day; none on trade), **52** (see H4), **53** (contest page reads Liga `topic_snapshots`), **54** (contest ranking `ROW_NUMBER` no tie-break), **55** (no bet cap in contest; "Usar tudo" button), **57** (annual limit calendar-year not rolling), **59** (pioneer bonus fires on private bolões — `payout.ts:271` ungated), **60** (rejected topics: no reason; `admin/rejeitar` stores none), **61** (Z$ conservation dashboard excludes `community_bets`/`concurso_bets`/`concurso_wallets`), **63** (resolver cron no idempotency lock — see C7), **76** (dual polling topic page), **77** (navbar `select *` wallet poll 30s; no Realtime), **78** (no lazy-load; recharts ~371KB static), **79** (cancel orders O(N)), **80** (unbounded ranking query), **94** (`auto-replenish` N+1), **95** (orderbook 24h volume summed in JS).

New MEDIUM `[NEW]`: notification `payload` vs `data` column drift (amigos/ligas routes write `payload`, rest read `data`); bulk mark-read uses POST (#92 residual); `match-orders` cron only seeds one order per topic (no full book sweep); snapshot prob sourced from volume not order-book price; admin role check duplicated inline in 7 routes (no middleware gate on `/api/admin/*`); `aprovar` hard-deletes `bets` with `amount<=0` unlogged; IRRF legal text inconsistent (Termos "30% sobre o total" vs DadosBancarios "acima de R$1.903,98"); MobileNav missing Amigos/Privadas; resolution-layer labels inconsistent between writer (`oracle_api`/`oracle_ai_direto`) and reader (`api_fixa`); volume metric omits 3 Z$-bearing tables; `aceitar`/`convidar-aposta` don't verify friendship/block state.

---

## ⛔🔵 LOW (open)

Original still open: **81** (welcome modal "Z$200" vs DB Z$500 — `WelcomeModal.tsx:226`), **82** (comments no loading state), **83** (duplicated `buildPos`), **85** (FP payout residue not reconciled to pool — `payout.ts:146` per-winner `toFixed` without remainder distribution; breaks rule 4 at scale), **86** (cancelled markets use `resolved` status; `admin/resolver` checks a `cancelled` status never written), **88** (no email notifications), **89** (no notify on friend-request accept), **90** (OG endpoint ignores `type`), **91** (community events no OG metadata), **93** (5 cron routes still emit "Unauthorized" vs "Não autorizado"), **96** (several tables SELECT-only RLS).

New LOW `[NEW]`: `validacaoAI` fails open (`ai-triple-check.ts:219` returns true on exception); `salvarResolucao` swallows insert failures; pioneer bonus picks first incl. `exited`/`lost` bets; open-redirect `//evil.com` passes `next.startsWith("/")` guard; `next.config.mjs:5` `eslint.ignoreDuringBuilds:true`; `<img>` instead of `next/image` in navbar; 4 separate polling timers per authed user on a topic page.

---

## 🆕 New agent: zafe-crosscheck — duplicate/overlapping events

> Structural check on **seed data only** (migrations 009/011/012/019 + `seed-eventos.mjs`); no live DB. SQL inserts are `WHERE NOT EXISTS`-guarded (idempotent on same DB); `seed-eventos.mjs` uses plain `.insert()` with **no guard** → it physically duplicates on re-run.

- **🔴 Exact duplicates (5+):** Econômico events seeded twice in 011↔012 (IPCA abr <0,3%; dólar <R$5,70 maio; Ibovespa 145k; Petrobras aumento; Bitcoin US$95k) — 012 is literally titled "sem duplicatas". Plus heavy template overlap 009↔`seed-eventos.mjs`.
- **🟡 Semantic duplicates (9 clusters):** ChatGPT 500M, Apple iPhone dobrável, satélite 6G, BBB 80%, filme BR streaming, Corinthians classificar, Real Madrid eliminar, Flamengo clássico — same event reworded across 011/012.
- **🟠 Cross-module conflicts (4):** Palmeiras×São Paulo @ Morumbi exists in both Liga (vencer) and Concurso (golear) with different dates; reforma tributária ×3; reforma Previdência ×2; Selic/Copom ×3 (corte vs manter not modeled as one binary).
- **🔵 Misplaced (~16):** Econômico-category events live in the shared `topics` pool (no separate module table) — only `category='economia'` separates them from Liga.
- **Action:** dedupe 011↔012; consolidate semantic pairs; align Liga↔Concurso fixtures 1:1; model contradictory Copom events as one binary; gate `seed-eventos.mjs` with an upsert. Report-only — verify bet/volume counts before any merge/delete.

---

## 🆕 New agent: zafe-validity — events impossible in the real world

> Based on **seed data only** (no live DB); events referenced by title+`closes_at` (IDs are `gen_random_uuid()` at insert). Today = 2026-06-03. Report-only — never auto-resolve.

- **🔴 IMPOSSIBLE with FUTURE deadlines (still bettable) — 9, highest priority:**
  - "Nadal vai ganhar seu 15º Roland Garros" — Nadal retired 2024.
  - All June **Eliminatórias** events (Brasil×Argentina 06-10, golear Paraguai 06-18) — South American qualifiers already concluded.
  - "Flamengo vai liderar o Brasileirão ao fim de junho" (06-30) & "Palmeiras×Corinthians Dérbi" (06-15) — **Brasileirão paused 11/06–19/07 for the World Cup**, no June rounds.
  - "Botafogo se classificar nas oitavas da Libertadores" (06-25) — group stage ends 28/05, knockouts only from August.
  - Brasil×Venezuela Eliminatórias (05-13, past).
- **🟡/🟠 Past-deadline (overdue if still active):** essentially **all** of `seed-eventos.mjs` (April), `011` and `012` (May) — outcomes already known.
- **🔵 Flagged:** "Copom corte 0,50% em maio" — **no COPOM meeting in early May 2026** (calendar: Jan/Mar/Apr/Jun…) → likely data-entry error; WWDC events dated April (WWDC is June); Oscar 2026 already happened (March).
- **✅ Valid/open:** most of `019` (June: Copom 17/06, dólar/IPCA/Ibovespa/BTC June, arcabouço fiscal, STF marco temporal, WWDC 09/06, etc.).
- **Root cause:** authors didn't account for the **World Cup pause** and concluded qualifiers/Libertadores group stage. Sources: ESPN/CNN (Nadal), FIFA/Wikipédia (Eliminatórias), Olympics.com (Libertadores), BCB/InfoMoney (Copom calendar).

---

## Recommended Priority Fix Order (updated)

> ✅ **Items 1–6 (all CRITICALs except #7) completed 2026-06-03.** Remaining residuals noted inline (`18`/reversal-clawback logging, `H13` verdict mapping). #7 left to the user.

1. ~~**C1**~~ ✅ ZC$ contest double-spend fixed via `adjustConcursoBalance` CAS + checked rewire of `concurso/palpitar`.
2. ~~**C3 / C4**~~ ✅ Enums + `notifications` columns reconciled in migration `020`; `refund`→`bet_refund` in code.
3. ~~**C8 / 4 / 5 / 6**~~ ✅ Schema reproducible: `005_concurso_core.sql` + `021_missing_tables.sql`; duplicate 008 renamed; `ligas.is_public`/`parent_liga_id` added to `003`. Residual: `desafios` parent table (flagged in `021`).
4. ~~**C5 / C6**~~ ✅ All cron routes accept GET; Vercel is the single scheduler (GitHub Actions → manual-only). Idempotency claim added (C7).
5. ~~**C2**~~ ✅ `concurso_wallets` payout + `comunidade/contestar` routed through CAS. ⛔ Residual `18` (reversal clawback logging) still open.
6. ~~**C7**~~ ✅ Atomic `claimTopicForResolution` claim before paying. ⛔ Residual `H13` (positional verdict mapping) still open.
7. ~~**H1 / 57**~~ 🟡 PARTIAL 2026-06-05 — rolling 365-day window + `convidar` pre-check done. Residual: allies-pairing semantics + check→debit TOCTOU need a Postgres function + compliance decision. **Also fixed this pass: H2, H6, H8, H9** (whitelist clone, `.or()` injection, bet-input validation, parimutuel payout quote).
8. **10** — Stand up vitest + CI gate; first tests: wallet CAS, order matching/escrow, payout conservation, contest scoring.
9. **11 / 12 / 14 / H5 / H7** — Password reset, login rate-limit, enforce email verification, HttpOnly session, 18+ age-gate.
10. **31 / 32** — Materialize `v_topic_stats` (or denormalize) and batch the payout loop.
11. **zafe-validity** — Manually resolve/refund the 9 impossible future-dated events before users bet on them.
12. **7** — Rotate the leaked service_role / VAPID / Firecrawl keys and remove the hardcoded key from `seed-eventos.mjs`.
