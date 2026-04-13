# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint check
npx vercel --prod # Deploy to production (no GitHub auto-deploy)
```

## Architecture

### Stack
- **Next.js 14** (App Router) + TypeScript (strict mode)
- **Supabase** (Postgres + Auth + Realtime)
- **Tailwind CSS** + shadcn/ui components
- **@anthropic-ai/sdk** for AI-powered market resolution oracles and proof evaluation

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

**Rule:** API routes that need to write to tables should use `createAdminClient()` after manually verifying `auth.getUser()`. The user client is subject to RLS and will silently fail if policies are missing.

### Data Types
All database types are in `types/database.ts`. Key types: `Topic`, `Bet`, `BetMatch`, `Profile`, `Wallet`, `Transaction`, `Friendship`, `PrivateBetInvite`, `Notification`.

Enums to know:
- `TopicStatus`: `pending` → `active` → `resolving` → `resolved` | `cancelled`. There is NO `closed` status.
- `BetSide`: `sim` | `nao` (Portuguese yes/no)
- `TopicCategory`: `politica` | `esportes` | `cultura` | `economia` | `tecnologia` | `entretenimento` | `outros`
- `DesafioStatus`: `active` → `resolving` → `awaiting_proof` → `proof_submitted` → `under_contestation` → `admin_review` → `resolved` | `cancelled`

### Two Market Types

**1. Tópicos** (`/topicos`, `app/(main)/topicos/`) — Admin-moderated public markets
- Created via `POST /api/criar`, go into `pending` status until admin approves
- Resolution: AI oracle (`lib/oracles/`) tries first; falls back to admin
- Payout: 6% platform commission, 94% to winners (parimutuel)
- Slug URLs: `/topicos/[slug-or-uuid]` — lookup handles both

**2. Desafios** (`/desafios`, `app/(main)/desafios/`) — User-created micro-markets
- Created via `POST /api/desafios/criar`, immediately `active`
- Creator cannot bet on their own desafio
- Resolution: creator submits proof after `closes_at` → Claude evaluates → 48h contestation
- Payout: 6% creator fee + 6% platform + 88% to winners
- Proof evaluation: `lib/proof-processor.ts` server-side pipeline (fetchs content, Google Vision) → `claude-sonnet-4-6` judges

### Business Logic (`/lib`)
- `odds.ts` — Parimutuel odds: `calcOdds(volumeSim, volumeNao)`. Winners split the losing pool minus **6% commission** (94% payout).
- `order-matching.ts` — Secondary market engine: FIFO price-time matching, **2% commission** on seller.
- `private-bets.ts` — Peer-to-peer bet resolution: leader election requires 67% supermajority per side.
- `webpush.ts` — `sendPushToUser(userId, payload)` uses VAPID; auto-cleans stale subscriptions.
- `oracles/` — Anthropic AI agents per category for automated market resolution (`ai-triple-check.ts` does triple verification).
- `proof-processor.ts` — Server-side proof pipeline for desafios: links→fetchText, fotos→base64+Google Vision, YouTube→oEmbed+thumbnail.
- `desafios-payout.ts` — `pagarDesafio()` / `reembolsarDesafio()` for desafio resolution.
- `slugify.ts` — URL slug generation for topic titles.
- `utils.ts` — `cn()`, `formatCurrency()` (Z$), `formatPercent()`, `applyCommission()`, `CATEGORIES` array.

### Key Database Views & Tables
- `v_topic_stats` — Aggregated stats per topic: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `prob_nao`, `bet_count`.
- `v_desafio_stats` — Same for desafios: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `bet_count`.
- `topic_snapshots` — Historical prob/volume snapshots for probability chart.
- `desafio_snapshots` — Same for desafios (populated by `fechar-mercados` cron).
- `orders` — Secondary market orders. Has both `topic_id` (nullable) and `desafio_id` (nullable).
- `trades` — Executed trades. Has both `topic_id` and `desafio_id` (nullable).

### Wallet Flow
- **Primary market (apostas):** debit on bet placement (optimistic lock).
- **Secondary market (orders):** balance validated on order placement but **debit only at trade execution**.
- Transaction types: `bet_placed`, `bet_won`, `bet_refund`, `commission`, `bet_exited`.
- All wallet mutations use optimistic locking to prevent double-spend.

### Notifications
Two delivery channels: insert into `notifications` table (in-app) + call `sendPushToUser()` (Web Push). Non-blocking — use `Promise.allSettled`.

### Styling
Dark theme (black bg). Primary green `#86efac`. Bet sides: `--sim` (green) and `--nao` (red). All components use `cn()` from `lib/utils.ts`.

### Secondary Market (Mercado Secundário)
Order book per market side. Works for both Tópicos and Desafios:
- Tópicos: `GET /api/topicos/[id]/orderbook`, `POST/DELETE /api/topicos/[id]/ordem/[orderId]`
- Desafios: `GET /api/desafios/[id]/orderbook`, `POST/DELETE /api/desafios/[id]/ordem/[orderId]`
- Matching via `lib/order-matching.ts`: pass `desafioId` param to `tryMatchOrders()` for desafio orders; omit for topic orders.
- UI: `MercadoSecundario` accepts either `topicId` or `apiBase` prop. `ProbabilityChart` and `LiveStats` accept either `topicId` or `chartUrl`.

### Market Auto-Expiry / Crons
- `POST /api/cron/fechar-mercados`: moves expired topics → `resolving`, takes snapshots for both topics and desafios, auto-pays expired contestations, auto-refunds expired proof deadlines, triggers oracle for expired desafios.
- `POST /api/cron/resolver-oracle`: processes topics in `resolving` state via AI oracle.
- Desafio oracle at `POST /api/desafios/[id]/resolver`: resolves via AI; if uncertain → `awaiting_proof`.

### Proof Evaluation (Desafios)
1. Frontend sends `proof_url` or `raw_image_base64` to `POST /api/desafios/[id]/submeter-prova`
2. Server calls `processProof()` from `lib/proof-processor.ts`: downloads content, calls Google Vision API (`GOOGLE_VISION_API_KEY` env var), returns `ProcessedProof` with text summary + base64 images
3. `claude-sonnet-4-6` receives the prepared content (text + image blocks) and returns `{ aprovado, confianca, motivo }`
4. Approved → `under_contestation` (48h window); Rejected → `+24h` for new proof

### SEO / Sitemap
- `app/sitemap.xml/route.ts` — dynamic route handler using `createAdminClient()` at runtime.
- Deployed at `zafe-rho.vercel.app` (no custom domain yet). No GitHub auto-deploy — use `npx vercel --prod`.

### OG Image
- `GET /api/og?id=[uuid]&type=topico|desafio` — gera imagem 1200×630 via `next/og` (edge runtime).
- Mostra título, barra de probabilidade SIM/NÃO, volume total, categoria e badge "Desafio" se aplicável.
- Usado no `generateMetadata` de `/topicos/[id]` e `/desafios/[id]` como `openGraph.images` e `twitter.images`.
- Twitter card muda de `summary` para `summary_large_image`.

### Trending Feed
- `/topicos?tab=em-alta` — aba "Em Alta 🔥" na listagem de tópicos.
- Calcula volume apostado por tópico nas últimas 2 horas via query em `bets.created_at >= now()-2h`.
- Mostra badge "+Z$ X / 2h" por card e ranking #1/#2/#3 nos três primeiros.
- Sem filtros de categoria/busca nessa aba (feed em tempo real puro).

### Notificação In-App 2h antes do fechamento
- O cron `fechar-mercados` já enviava push 2h antes. Agora também insere na tabela `notifications` com type `market_closing`.
- Enum `notification_type` foi extendido com `market_closing` (migração `add_market_closing_notification_type`).

### ResolvingBanner
- Componente `components/topicos/ResolvingBanner.tsx` — client component com polling.
- Exibido em `/topicos/[id]` quando `status = 'resolving'` e em `/desafios/[id]` quando `status IN ('resolving', 'proof_submitted', 'admin_review')`.
- Polling a cada 5s via `GET /api/topicos/[id]/status` ou `GET /api/desafios/[id]/status`.
- Faz `router.refresh()` automaticamente quando o status mudar para `resolved` ou `cancelled`.
- Após 120s mostra mensagem de fallback ("admin resolverá em breve").

### Perfil Público
- Já existia em `app/(main)/u/[username]/page.tsx`.
- Mostra: vitórias, derrotas, taxa de acerto, P&L, sequência atual, melhor categoria, histórico de apostas.

### Versioning Policy
- **Major features** (new systems, new pages) → new git tag: `v1.1`, `v1.2`, etc.
- **Small fixes** → in-place edits on current version.
- Current version: **v1.3** (Trending feed, OG image, ResolvingBanner, notificação in-app 2h, títulos simplificados, descrições enriquecidas nos 30 eventos sem apostas).

### Language
All UI text, route names, variable names, and user-facing content are in **Brazilian Portuguese (pt-BR)**.
