# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
npm run start     # Start production server
```

Seed scripts (Node.js, run directly):
```bash
node scripts/seed-topics.js
node scripts/seed-eventos.mjs
```

## Architecture

### Stack
- **Next.js 14** (App Router) + TypeScript (strict mode)
- **Supabase** (Postgres + Auth + Realtime)
- **Tailwind CSS** + shadcn/ui components
- **Zod** for validation, **react-hook-form** for forms
- **@anthropic-ai/sdk** for AI-powered market resolution oracles

### Route Groups
- `app/(auth)/` — Public routes (login, OAuth callback)
- `app/(main)/` — Protected routes (requires Supabase session)
- `app/admin/` — Admin-only (requires `profiles.is_admin = true`)
- `app/api/` — API routes (backend logic)

Auth guard and admin check live entirely in `middleware.ts`.

### Supabase Clients
Two clients, never mix them:
- `lib/supabase/client.ts` → `createBrowserClient()` for Client Components
- `lib/supabase/server.ts` → `createServerClient()` for Server Components/API routes, plus `createAdminClient()` (service role) for privileged ops

### Data Types
All database types are in `types/database.ts`. Key types: `Topic`, `Bet`, `BetMatch`, `Profile`, `Wallet`, `Transaction`, `Friendship`, `PrivateBetInvite`, `Notification`.

Enums to know:
- `TopicStatus`: `pending` → `active` → `resolved` | `cancelled`
- `BetSide`: `sim` | `nao` (Portuguese yes/no)
- `TopicCategory`: `politica` | `esportes` | `cultura` | `economia` | `tecnologia` | `entretenimento` | `outros`

### Business Logic (`/lib`)
- `odds.ts` — Parimutuel odds: `calcOdds(volumeSim, volumeNao)`. Winners split the losing pool minus **4% commission** (96% payout).
- `order-matching.ts` — Secondary market engine: FIFO price-time matching, **2% commission** on seller.
- `private-bets.ts` — Peer-to-peer bet resolution: leader election requires 67% supermajority per side.
- `webpush.ts` — `sendPushToUser(userId, payload)` uses VAPID; auto-cleans stale subscriptions (410/404).
- `oracles/` — Anthropic AI agents per category for automated market resolution (`ai-triple-check.ts` does triple verification).
- `utils.ts` — `cn()`, `formatCurrency()` (Z$), `formatPercent()`, `applyCommission()`, `CATEGORIES` array.

### Key Database Views
- `v_topic_stats` — Aggregated market stats: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `prob_nao`, `bet_count`. Use this instead of querying `bets` directly for market display.

### Wallet Flow
All wallet mutations must use optimistic locking to prevent double-spend. Debit happens before inserting bet records. Transaction types: `bet_placed`, `bet_won`, `bet_refund`, `commission`, `secondary_buy`, `secondary_sell`.

### Notifications
Two delivery channels from the same event: insert into `notifications` table (in-app) + call `sendPushToUser()` (Web Push via VAPID). Non-blocking — use `Promise.allSettled`.

### Styling
Dark theme (black bg). Primary green `#86efac`. Bet sides have CSS variables: `--sim` (green) and `--nao` (red). All components use `cn()` from `lib/utils.ts`.

### Language
All UI text, route names, variable names, and user-facing content are in **Brazilian Portuguese (pt-BR)**.
