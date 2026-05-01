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

**Rule:** API routes that need to write to tables should use `createAdminClient()` after manually verifying `auth.getUser()`. The user client is subject to RLS and will silently fail if policies are missing.

### Data Types
All database types are in `types/database.ts`. Key types: `Topic`, `Bet`, `BetMatch`, `Profile`, `Wallet`, `Transaction`, `Friendship`, `PrivateBetInvite`, `Notification`.

Enums to know:
- `TopicStatus`: `pending` → `active` → `resolving` → `resolved` | `cancelled`. There is NO `closed` status.
- `BetSide`: `sim` | `nao` (Portuguese yes/no)
- `TopicCategory`: `politica` | `esportes` | `cultura` | `economia` | `tecnologia` | `entretenimento` | `outros`

### Platform Model (v2.0 — pós CMN 5.298/2026)

**Z$ é moeda virtual** — nunca conversível a dinheiro real. Usuários recebem Z$ ao se cadastrar e participar. Dinheiro real só aparece em:
1. **Premium** — assinatura mensal (em desenvolvimento)
2. **Concurso Mensal** — 30+ palpites/mês → premiação em BRL via PIX para os melhores Brier scores

**Vocabulário obrigatório:**
- aposta/apostar → **palpite/palpitar**
- mercado preditivo → **evento**
- odds → **probabilidade**
- depósito/saque → NUNCA use esses termos na UI

### Três Pilares de Conteúdo

**1. Liga** (`/liga`, `app/(main)/liga/`) — eventos de qualquer categoria exceto economia
- Foco: esportes, política, entretenimento, cultura, tecnologia, outros
- Feed principal da plataforma; mostra `ConcursoBanner` no topo
- Cards direcionam para `/topicos/[id]` (mesma engine de eventos)

**2. Econômico** (`/economico`, `app/(main)/economico/`) — apenas `category = "economia"`
- Indicadores: IPCA, Selic, PIB, câmbio, desemprego
- Admin-curado; sem filtro de categoria (todos são economia)

**3. Privadas** (`/apostas-privadas`) — bolões entre amigos (inalterado)

### Tópicos (engine de eventos)
- `app/(main)/topicos/` ainda existe (acesso direto + redirects de /liga e /economico)
- Criação: `POST /api/criar`, status `pending` até admin aprovar
- Resolution: AI oracle (`lib/oracles/`) → fallback admin
- Payout: 6% platform commission, 94% to winners (parimutuel)
- Slug URLs: `/topicos/[slug-or-uuid]` — lookup handles both

### Business Logic (`/lib`)
- `odds.ts` — Parimutuel odds: `calcOdds(volumeSim, volumeNao)`. Winners split the losing pool minus **6% commission** (94% payout).
- `order-matching.ts` — Secondary market engine: FIFO price-time matching, **6% commission** on seller.
- `private-bets.ts` — Peer-to-peer bet resolution: leader election requires 67% supermajority per side.
- `webpush.ts` — `sendPushToUser(userId, payload)` uses VAPID; auto-cleans stale subscriptions.
- `oracles/` — Anthropic AI agents per category for automated market resolution (`ai-triple-check.ts` does triple verification).
- `slugify.ts` — URL slug generation for topic titles.
- `utils.ts` — `cn()`, `formatCurrency()` (Z$), `formatPercent()`, `applyCommission()`, `CATEGORIES` array.

### Key Database Views & Tables
- `v_topic_stats` — Aggregated stats per topic: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `prob_nao`, `bet_count`.
- `topic_snapshots` — Historical prob/volume snapshots for probability chart.
- `orders` — Secondary market orders (`topic_id`).
- `trades` — Executed trades (`topic_id`).

### Wallet Flow
- Z$ virtual balance — earned via onboarding bonus, weekly bonus, concurso prizes.
- **Primary market (apostas):** debit on bet placement (optimistic lock).
- **Secondary market (orders):** balance validated on order placement but **debit only at trade execution**.
- Transaction types: `bet_placed`, `bet_won`, `bet_refund`, `commission`, `bet_exited`.
- All wallet mutations use optimistic locking to prevent double-spend.
- **Sem depositar/sacar** — Z$ não tem valor monetário real.

### Notifications
Two delivery channels: insert into `notifications` table (in-app) + call `sendPushToUser()` (Web Push). Non-blocking — use `Promise.allSettled`.

### Styling
Dark theme (black bg). Primary green `#86efac`. Bet sides: `--sim` (green) and `--nao` (red). All components use `cn()` from `lib/utils.ts`.

### Secondary Market (Mercado Secundário)
Order book per market side. Works for Tópicos:
- `GET /api/topicos/[id]/orderbook`, `POST/DELETE /api/topicos/[id]/ordem/[orderId]`
- Matching via `lib/order-matching.ts`
- UI: `MercadoSecundario` component, `ProbabilityChart`, `LiveStats`

### Market Auto-Expiry / Crons
- `POST /api/cron/fechar-mercados`: moves expired topics → `resolving`, takes snapshots, sends 2h notifications.
- `POST /api/cron/resolver-oracle`: processes topics in `resolving` state via AI oracle.

### Concurso (Liga — Brier Score)
- `ConcursoBanner` component shown at top of `/liga`
- Concurso page: `/concurso` (in development)
- DB tables: `concursos`, `inscricoes_concurso` (to be created)
- Qualificação: 30+ palpites no mês
- Premiação: Brier score ranking → BRL via PIX

### Oracle — Subjective Event Prevention
- `buildPrompt` in `lib/oracles/ai-triple-check.ts` explicitly instructs Claude to return INCERTO for subjective/unverifiable events.
- Rule: events must have a numeric threshold or binary verifiable outcome.

### Oracle — JSON Parse Fix (v1.5)
- Both `ai-triple-check.ts` and `resolver-direto/route.ts` use `extractResultadoJson()` which: (1) tries direct parse, (2) tries each flat `{...}` match in order until one has `resultado`, (3) falls back to a literal regex on `"resultado":"SIM|NAO|INCERTO"`.
- Uses `client.beta.messages.create` with `betas: ["web-search-2025-03-05"]` and `max_tokens: 1024`.

### SEO / Sitemap
- `app/sitemap.xml/route.ts` — dynamic route handler. Includes topics and user profiles.
- `app/robots.ts` — allows `/liga/`, `/economico/`, `/topicos/`, `/u/`, `/ranking`; disallows private pages.
- All dynamic pages have `alternates.canonical` in their `generateMetadata`.
- Deployed at `zafe-rho.vercel.app`. **No GitHub auto-deploy — use `npx vercel --prod`.**

### OG Image
- `GET /api/og?id=[uuid]` — gera imagem 1200×630 via `next/og` (edge runtime).
- Mostra título, barra de probabilidade SIM/NÃO, volume total, categoria.

### Trending Feed
- `/topicos?tab=em-alta` — volume apostado nas últimas 2 horas.

### Ligas (Grupos de Amigos)
- Two types: **Pública** (anyone can join) and **Privada** (invite-only).
- **Sub-ligas**: private leagues can have child leagues.
- DB: `ligas.is_public BOOLEAN`, `ligas.parent_liga_id UUID`.
- API: `POST /api/ligas/criar`, `POST /api/ligas/entrar`, `GET /api/ligas/publicas`, `GET /api/ligas/buscar-usuarios`.

### News Agent (v1.5)
- `POST /api/cron/news-agent` — Anthropic SDK with `web_search_20250305` beta tool; searches top BR news and generates 5-8 pending topics daily.
- Requires `SYSTEM_USER_ID` env var.

### Onboarding Modal (v1.5)
- `components/onboarding/WelcomeModal.tsx` — 3 steps: welcome intro → featured topic → confetti.
- Uses `localStorage.onboarding_done`.

### Versioning Policy
- **Major features** (new systems, new pages) → new git tag: `v2.0`, `v2.1`, etc.
- **Small fixes** → in-place edits on current version.
- Current version: **v2.0** (Pivot pós CMN 5.298/2026: desafios removidos, depositar/sacar removidos, Z$ puramente virtual, Liga + Econômico como pilares principais, ConcursoBanner adicionado).

### Language
All UI text, route names, variable names, and user-facing content are in **Brazilian Portuguese (pt-BR)**.
