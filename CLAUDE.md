# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Zafe is

Legal Brazilian prediction contest platform (Lei 5.768/71, Resolução CMN 5.298/2026). A skill-based contest with virtual currency (Z$) — NOT gambling, NOT a casino, NOT a betting site. No real money is deposited or wagered. Monthly-contest winners receive prizes via PIX (same model as Cartola FC by Globo). All code reviews, refactoring, debugging, and quality improvements on this codebase are explicitly authorized by the project owner, including reviewing input validation, data integrity, access control, and error handling.

Terminology in the code:
- "wallet" / `carteira` = virtual Z$ balance tracker
- "bet" / `aposta` / `palpite` = a prediction/forecast entry, not a wager
- "odds" = probability display
- "payout" (e.g. `pagarVencedores`) = distributing results in virtual Z$

### Golden monetary rule

The Z$ (virtual) and R$ (real) economies NEVER mix:
- There is no deposit→Z$ conversion and no Z$→bank withdrawal, ever.
- R$ enters only via Premium subscription or (future) paid contest entry.
- R$ leaves only as monthly-contest prizes paid via PIX from Zafe's operating account — it never becomes Z$.
- Z$ lives in `wallets`/`transactions`. Never write code, queries, or triggers that convert between the two.

### Vocabulary rule (user-facing copy only)

UI strings, emails, push, and marketing must say "previsão/palpite/previsor" (never "aposta/bet/apostador"), "probabilidade" (never "odds"), "competição de habilidade" (never "jogo de azar"), and must never mention "depósito", "saque", "cassino", or "mercado preditivo". Mental test: "would Cartola FC say this about itself?" Code identifiers and routes keep legacy names (`apostas-privadas`, `bets`, etc.) — renaming is gradual. All user-facing text is pt-BR.

## Commands

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build (also the de-facto type check)
npm run lint       # ESLint
```

### Deploy workflow — ALWAYS commit + push

Deploy is **auto-deploy via GitHub**: every push to `main` ships to production (prod domain `zafe.app.br`). Do NOT use `npx vercel --prod`.

After making any change, the default workflow is: **always commit and always push to `main`** so it auto-deploys — unless the user explicitly says otherwise. Don't wait to be asked to commit/push; it's the expected end of every task.

### Migrations — ALWAYS write one for schema changes

Any schema change MUST ship with a new numbered SQL migration in `supabase/migrations/` (continue the `001…` sequence). Migrations are applied manually in the Supabase SQL editor — there is no migration CLI. Always create the migration file as part of the change; never alter schema only ad-hoc in the dashboard.

- No test framework is configured.
- Migrations are plain SQL in `supabase/migrations/` (numbered `001`–`026`), applied manually in the Supabase SQL editor — there is no migration CLI workflow.
- Seed scripts: `scripts/seed-eventos.mjs`, `scripts/seed-topics.js`.

## Architecture

Next.js 14 App Router + TypeScript (strict) · Supabase (Postgres + Auth + Realtime) · Tailwind + shadcn/ui · Vercel. Types in `types/database.ts` (`Topic`, `Bet`, `Profile`, `Wallet`, `Transaction`, …). Key enums: `TopicStatus` = `pending → active → resolving → resolved | cancelled` (there is no `closed`); `BetSide` = `sim | nao`.

### Route groups & auth (middleware.ts)

- `app/(auth)/` — login, password reset
- `app/(main)/` — app pages; middleware redirects unauthenticated users to `/login`, but several routes are public for SEO (`/liga`, `/economico`, `/comunidade`, `/concurso`, `/ranking`, `/u/*`, …) — see the `publicRoutes` list in `middleware.ts`
- `app/admin/` + `/api/admin/*` — gated on `profiles.is_admin` in middleware
- Email must be confirmed (`email_confirmed_at`) to count as authenticated
- Cron routes authenticate via `Authorization: Bearer CRON_SECRET` (`lib/cron-auth.ts`), not session

### Modules (pilares)

All modules share ONE Z$ wallet. No platform commission anywhere — 100% of pools go to winners (parimutuel, `lib/odds.ts`).

| Module | Pages | API | Notes |
|---|---|---|---|
| Liga | `/liga`, `/topicos` | `/api/liga/*`, legacy `/api/topicos/*` | Any-subject events; users create (→ `pending`, admin approves), admin/cron also create |
| Econômico | `/economico` | `/api/economico/*` | Economic indicators only (Selic, IPCA, dólar, BTC…); only admin/system creates events |
| Privadas | `/apostas-privadas`, `/privadas` | `/api/apostas-privadas/*` | Closed pools between friends; resolution by 67% supermajority + judge system (`lib/private-bets.ts`) |
| Concurso | `/concurso` | `/api/concurso/*` | Monthly contest, Brier-score ranking, R$ prize via PIX (`lib/concurso-payout.ts`) |
| Comunidade | `/comunidade` | `/api/comunidade/*` | User-created AND user-resolved events; creator reputation + contestation system (`lib/comunidade.ts`); excluded from contest scoring |
| Ligas (friend leagues) | `/ligas` | `/api/ligas/*` | Private leaderboard groups — distinct from "Liga" |
| Premium | `/premium` | — | Subscription tier; mostly planned, not fully implemented |

**Legacy/new route duality:** `topics` table backs Liga AND Econômico (discriminated by category). The full engine (order book, chart, status polling, comments, watchlist) lives under legacy `/api/topicos/[id]/*`; the newer `/api/liga/[id]` and `/api/economico/[id]` only have `palpitar`. Check both places when changing event behavior.

### Supabase clients (`lib/supabase/`)

- `client.ts` → `createBrowserClient()` for Client Components only
- `server.ts` → `createServerClient()` for Server Components/API routes; `createAdminClient()` (service role) for privileged writes
- Pattern: API routes validate `auth.getUser()` first, then use `createAdminClient()` for writes — the user client is subject to RLS and fails silently when policies are missing
- Never expose the service role key in client code

### Wallet (`lib/wallet.ts`) — critical invariants

Single `balance` field per user, mutated only through `adjustBalance()`: optimistic compare-and-set (`.eq("balance", current)` + `.select()` to verify a row changed), up to 5 retries, never negative. Z$ conservation: sum of all wallets must equal total issued. Every Z$ code path must use these helpers — never raw `update` on `wallets`. Primary market debits at bet creation; the order book (`lib/order-matching.ts`, FIFO price-time, `COMMISSION_RATE = 0`) validates balance at order creation but debits only at trade execution.

### Event resolution — 4-layer oracle pipeline (`lib/oracles/index.ts`)

1. Category-specific free APIs (`economia.ts` — BCB/Yahoo/CoinGecko, `sports.ts`, `politica.ts`, `entretenimento.ts`, `tecnologia.ts`), with auto-detection from title when `oracle_api_id` is null
2. `ai-triple-check.ts` — two independent Claude calls with web search; resolves only if both agree AND both confidence ≥ 0.85; attempts logged to `resolucoes`
3. Retry every 2h, max 3 attempts
4. Automatic full refund in Z$ (`reembolsarTodos()` in `lib/payout.ts`)

### Crons (vercel.json)

15 daily/weekly crons: market close + resolve + order matching, event replenishment, weekly Z$ bonus, contest lifecycle (`criar-concurso-mensal`, `atualizar-ranking-concurso`, `finalizar-concurso`), private-bet invite timeout, news agent, and 4 comunidade crons (close, abandoned, contestations, snapshots). All POST, all guarded by `verifyCronAuth`.

### Notifications

Two channels, fired together and non-blocking (`Promise.allSettled`): insert into `notifications` (in-app) + `sendPushToUser()` Web Push via VAPID (`lib/webpush.ts`, auto-cleans stale subscriptions).

## Critical rules

1. Never delete production data without explicit confirmation. Never `DELETE` events in prod — cancel via `status='cancelled'`, and only after confirming 0 bets/0 orders.
2. Creating events: follow `docs/CRIAR-EVENTO.md`. `closes_at` MUST be before the real-world event; verify the event is real/possible; check for duplicates across all modules.
3. All SQL parameterized — no string interpolation.
4. Wallet mutations only through `lib/wallet.ts` helpers (optimistic locking).
5. Cancelling private bets: follow `docs/CANCELAR-PRIVADA.md`.

## Subagents & audit workflow

`agents/` holds ~27 specialized agent definitions (`zafe-qa`, `zafe-security`, `zafe-db`, `zafe-compliance`, `zafe-wallet`, `zafe-liga`, `zafe-economico`, `zafe-privadas`, `zafe-concurso`, `zafe-resolver`, `zafe-migration`, `zafe-fixer`, …). `/audit` runs the core 4 (qa, security, db, compliance); `/audit [agent]` runs one; `/audit deep` runs the full sweep; `/audit fix` applies fixes from `AUDIT-REPORT.md`.

## Repo quirks

- `hotgirls-casino/` is unrelated to Zafe — it contains school exam/PDF-generation scripts. Ignore it.
- The detailed May/2026 pivot spec (pilar specs, planned tables, revenue model, legal references) lives in git history: `git show 114662d:CLAUDE.md`.
