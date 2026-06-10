# Zafe Audit Report — 2026-05-31

## Executive Summary

The platform's core architecture is sound (virtual Z$, parimutuel pool, skill-competition framing), but **wallet concurrency safety is critically broken** across multiple code paths. The biggest risk is permanent Z$ duplication or loss under concurrent load due to missing optimistic locking in payout, trade execution, and private bet flows. Immediate action required on 9 critical/high wallet-related issues before any production traffic.

## Critical (fix now)

| # | Source | Issue |
|---|--------|-------|
| 1 | `lib/order-matching.ts:191-211` | **executeTrade has no optimistic lock** — concurrent trades on same user read stale balance, causing Z$ duplication/loss |
| 2 | `lib/payout.ts:33,54,150,231` | **All payout functions (refund, bonus, winners) lack optimistic locking** — payout loops overwrite intermediate balances |
| 3 | `app/api/topicos/[id]/ordem/route.ts:110` | **BUY orders have no escrow** — balance checked but not debited, enabling double-spend via concurrent orders |
| 4 | `app/api/apostas-privadas/criar/route.ts:60` | **No optimistic lock on creator wallet debit** — concurrent requests can overdraft |
| 5 | `app/api/apostas-privadas/[id]/aceitar/route.ts:59` | **No optimistic lock on acceptor wallet debit** — same race condition |
| 6 | Multiple tables | **concurso_bets, concurso_wallets, comunidade_events, comunidade_bets, creator_reputation, desafio_bets** have no RLS migration — security posture unknown |

## High Priority

| # | Source | Issue |
|---|--------|-------|
| 1 | `001_initial.sql:239-240` | `bets_service_insert/update` use `WITH CHECK (true)` — any authenticated user can insert/update bets for any user_id |
| 2 | `001_initial.sql:226` | `transactions_service_insert` uses `WITH CHECK (true)` — users can fabricate Z$ credit history |
| 3 | `014_multi_outcome.sql` | `outcomes_service_write FOR ALL USING (true)` — any user can mutate pool data on multi-outcome markets |
| 4 | `lib/order-matching.ts:75-133` | **Double-match race** — two concurrent buy orders can match the same sell order (no DB lock) |
| 5 | `topic_snapshots` | No CHECK constraint on probability range; snapshots never updated after secondary market trades |
| 6 | `bets` table | No UNIQUE constraint on (user_id, topic_id, side) — app-level check is racy |
| 7 | `topics` RLS | Resolved markets invisible to non-creator bettors (policy only shows `active` or own) |
| 8 | All API routes | No rate limiting anywhere — wallet spam, market flood, referral fraud all possible |
| 9 | `middleware.ts` | `/api/admin/*` routes not protected by middleware — relies solely on per-route checks |
| 10 | `app/api/kyc/route.ts` | User self-sets `kyc_verified` with any valid CPF — no actual identity verification |
| 11 | `lib/order-matching.ts` executeTrade | Non-atomic multi-step (credit seller, debit buyer, insert trade) — partial failure leaves inconsistent state |
| 12 | Cron routes | If `CRON_SECRET` unset, admin-auth fallback allows any admin to trigger mass operations |
| 13 | `app/api/amigos/aceitar-aposta/route.ts:64-66` | Both wallet debits in `Promise.all` with no optimistic lock |

## Medium

| # | Source | Issue |
|---|--------|-------|
| 1 | `008_order_book.sql:59-60` | orders UPDATE policy has no WITH CHECK — users can alter price/quantity client-side |
| 2 | `wallets` RLS | `FOR ALL` policy allows user INSERT (shadowed by UNIQUE but conceptually wrong) |
| 3 | `wallets` | Buy-order balance not escrowed — same funds back multiple concurrent orders |
| 4 | `transactions` | `ON CONFLICT DO NOTHING` on bonus has no unique constraint to trigger on |
| 5 | `topics` | No CHECK constraint enforcing resolved markets have resolution populated |
| 6 | `concurso` migrations | Tables referenced in 010 but never created in numbered migrations — CI will fail |
| 7 | `app/api/criar/route.ts:27` | `(profile as any)?.role` — column doesn't exist, check always fails silently |
| 8 | `app/api/topicos/[id]/editar/route.ts` | No length limits on title/description |
| 9 | `app/api/admin/aprovar/route.ts` | House seed bets use admin's personal user_id instead of system account |
| 10 | `app/api/apostar/route.ts` | No `isFinite` / max cap validation on `amount` field |
| 11 | `lib/order-matching.ts:83` | Off-by-one: `remaining <= 0.01` skips matchable 0.01 Z$ orders |
| 12 | `lib/oracles/index.ts:84-89` | Concurso topic status never set to resolved/cancelled in refund path |
| 13 | `lib/order-matching.ts:34,136` | `admin` param typed as `any` — loses Supabase type safety |

## Low

| # | Source | Issue |
|---|--------|-------|
| 1 | Multiple API routes | Error responses leak raw Supabase error messages (table/column names) |
| 2 | `order-matching.ts` | Existing-order sweep is O(N^2) — performance concern at scale |
| 3 | `resolucoes` | INSERT intent undocumented — no policy clarifying service-role-only writes |
| 4 | `lib/payout.ts`, `lib/comunidade.ts` | ~108 occurrences of `: any` on Supabase client params |

## Compliance

| Status | Item | Action |
|--------|------|--------|
| FLAGGED | `009_seeds_templates.sql:100` — "As odds indicam favorito" | Replace with "As estatisticas apontam o Verdao como favorito" |
| FLAGGED | `009_seeds_templates.sql:101` — "o mercado aposta" | Replace with "o mercado preve" |
| FLAGGED | `011_novos_eventos_maio_2026.sql:130` — "Mercado aposta em aceleracao" | Replace with "Mercado preve aceleracao" |
| FLAGGED | `app/api/criar/route.ts` | Add category enum validation + forbidden-term filter |
| FLAGGED | `app/api/apostas-privadas/criar/route.ts` | Enforce 5.000 Z$/year per-pair limit |
| APPROVED | Concurso Mensal prize structure | Lei 5.768/71 compliant, SECAP dispensada |
| APPROVED | UI copy (termos, DiferenteDeBet) | Legal distancing language is correct |
| APPROVED | All seed market content | No harmful/hateful content |

## Stats

- **QA**: 17 issues (C:3 H:7 M:5 L:2)
- **Security**: 16 vulnerabilities (C:3 H:5 M:5 L:3)
- **DB**: 14 integrity issues (H:6 M:6 L:2)
- **Compliance**: 5 flags, 0 blocked

## Priority Fix Order

1. Add optimistic locking (`.eq("balance", wallet.balance)`) to every wallet write in `payout.ts`, `order-matching.ts`, `apostas-privadas/criar`, `apostas-privadas/aceitar`, `amigos/aceitar-aposta`
2. Add escrow deduction at BUY order placement in `/topicos/[id]/ordem`
3. Fix RLS policies: `bets_service_insert`, `transactions_service_insert`, `outcomes_service_write`
4. Wrap `executeTrade` in a Postgres RPC transaction
5. Add rate limiting middleware (Upstash or Vercel WAF)
6. Create proper migrations for concurso/comunidade tables with RLS
7. Fix compliance flags (forbidden terms in seeds, category validation, privadas limit)
