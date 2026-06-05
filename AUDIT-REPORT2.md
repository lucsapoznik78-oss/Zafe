# Zafe Audit Report 2 — Re-audited 2026-06-03

Original supplementary audit: 2026-05-31 (14 agents). **Re-run 2026-06-03 with all 25 agents** in `agents/` (incl. new `zafe-crosscheck` and `zafe-validity`). Each agent cross-checked its domain's original items against the **current code** (post commits `c5846d1` "resolve all critical" and `842f246` "resolve all HIGH") and added new findings.

Legend: ✅ RESOLVED · 🟡 PARTIAL · ⛔ STILL OPEN · `[NEW]` = found in this re-audit.

> **CRITICAL fix pass — 2026-06-03:** All CRITICAL items are now resolved **except #7** (key rotation — user declined this session). Done: **C1–C8** + originals **#4, #5, #6**. See each item below for the fix. Two follow-ups required by you: **(1)** apply migrations `005`, `020`, `021` to the live DB (all additive/idempotent); **(2)** rotate the leaked keys for #7. Residual schema gap: the `desafios` parent table (flagged in `021`).

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
- **H3 `[NEW]` — `executeTrade` is not atomic.** `lib/order-matching.ts:137-267` runs credits + bet inserts as independent awaits, no transaction. A mid-sequence failure pays the seller but creates no buyer position → Z$ conservation break. (economico, odds.)
- **H4 `[NEW]` — SELL orders still over-sellable.** `topics/[id]/ordem/route.ts:93-107` computes "available" via non-atomic read; two concurrent SELLs on the same `source_bet_id` both pass → position over-sold. (original #52 "fixed" but not concurrency-safe.) (economico.)
- **H5 `[NEW]` — Session cookie not HttpOnly/Secure.** `lib/supabase/client.ts:25` appends `httponly` as a string token that the browser ignores (JS can't set HttpOnly); token stays JS-readable + no enforced Secure/SameSite. Compounds #15. (auth, security.)
- **⛔🟠 ~~H6~~** ✅ FIXED 2026-06-05 — `buscar-usuarios` strips PostgREST-structural chars (`,()."*\%_`) from `q` before interpolating into `.or()`; `amigos/bloquear` now requires `blocked_id` to match a strict UUID regex before it reaches the `.or()` filter. (security, social.)
- **H7 `[NEW]` — No 18+ age-gate at signup.** `LoginForm.tsx:80-108` collects no DOB/age; only declarative in Termos. Platform pays R$ prizes via PIX. (compliance, auth.)
- **⛔🟠 ~~H8~~** ✅ FIXED 2026-06-05 — `amount` is now coerced with `Number()` and rejected unless `Number.isFinite && > 0` in `apostar`, `concurso/palpitar`, and `executeCommunityBet`; coercion at the top also stops string `amount` from corrupting pool arithmetic. (api.)
- **⛔🟠 ~~H9~~** ✅ FIXED 2026-06-05 — `BetForm` payout now uses true parimutuel `stake * (pool+stake)/(sidePool+stake)`, including the user's own stake in the denominator (pools 100/100 + bet 100 → Z$150, not Z$200). Dead odds vars/import removed. (odds.)
- **⛔🟠 ~~H10~~** ✅ FIXED 2026-06-05 — `aprovar` now debits the seeder's wallet (Z$2) via CAS before inserting the seed bets and records a `bet_placed` transaction; if balance is insufficient it activates the market without seeding. No more Z$ minted into the pool. ⛔ RESIDUAL: seed bets still sit on the admin's own account (a house/SYSTEM account excluded from payout — H14's `SYSTEM_USER_ID` — is the cleaner long-term design). (admin.)
- **⛔🟠 ~~H11~~** ✅ FIXED 2026-06-05 — "Ativos (30 dias)" now counts distinct users with ≥1 bet in the last 30 days (real activity proxy) instead of the non-existent `profiles.updated_at`. Proper `last_seen` instrumentation still absent (separate work). (analytics.)
- **H12 `[NEW]` — `wallets` has no `version` column.** `001_initial.sql:27-32`. Violates CLAUDE rule 3; CAS relies on matching `balance`, the root enabler of the silent double-spend class. (db.)
- **🟡 H13 `[NEW]` — `resolver-direto` verdict mapping.** ✅ PARTIAL 2026-06-05: mixed topics now pay **both** `bets` and `concurso_bets` (counts each table, runs `pagarVencedores` first so its atomic C7 claim wins, then `pagarConcursoBets`) — no set left unpaid. ⛔ RESIDUAL: verdicts are still keyed by 1-based prompt position; a missing/out-of-range `i` safely falls through to INCERTO (no wrong-market payout), but a model that *renumbers* can't be detected without echoing a per-topic identifier in the prompt. (resolver.)
- **H14 `[NEW]` — Deploy blockers:** `ANTHROPIC_API_KEY=sua_chave_aqui` placeholder in `.env.local:10`; `CRON_SECRET`/`SYSTEM_USER_ID` unset; cron cadence daily where #29/#30 require hourly. (deploy.)

### Original HIGH still open
- **⛔ 10.** Zero test infrastructure — confirmed: no vitest/jest, no `*.test.*`, no CI test gate (`cron.yml` only curls prod). (tests.)
- **⛔ 11.** No password reset flow (`resetPasswordForEmail` absent; no "esqueci a senha"). (auth, security.)
- **⛔ 12.** No login rate limiting / captcha. (auth, security.)
- **⛔ 13.** 2FA columns (`two_fa_enabled`, `two_fa_method`, `phone`) absent from all migrations; code reads/writes them. (db, auth.)
- **⛔ 14.** Email verification not enforced — `middleware.ts:28-39` only checks `getUser()` exists, never `email_confirmed_at`. (auth.)
- **⛔ 15.** JWT exposed to XSS — session cookie JS-readable (see H5). (auth, security.)
- **⛔ 16-residual.** `concurso_wallets` + `comunidade/contestar` lack optimistic lock (see C2). (wallet.)
- **⛔ 18.** Resolution reversal breaks Z$ conservation — `lib/comunidade.ts:320-324` `reverterResolucao` claws back via `debitBalance`, which **no-ops when balance insufficient** and the result is unchecked; bet is re-flipped + re-paid → Z$ created. No reversal transaction log. (resolver, wallet.)
- **⛔ 21.** Three admin flows missing — ban/suspend, per-user wallet view, manual Z$ adjustment (no DB `banned`/`suspended` column either). (admin, db.)
- **⛔ 31.** `v_topic_stats` performance bomb — still a plain view (`004_fix_stats_view.sql:4`), hit on every page + 15/30s polls + every bet. (perf, liga.)
- **⛔ 32.** Payout N+1 — `lib/payout.ts:145-170,224-255` 4+ sequential calls per bet; ~1,200 for a 500-bet market. (resolver, perf.)

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
