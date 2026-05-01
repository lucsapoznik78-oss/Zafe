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

### Supabase Clients — REGRA CRÍTICA

Dois clients, **nunca misturar**:
- `lib/supabase/client.ts` → `createBrowserClient()` para Client Components
- `lib/supabase/server.ts` → `createServerClient()` para Server Components/API routes; `createAdminClient()` (service role) para operações privilegiadas

**REGRA OBRIGATÓRIA — lida com atenção:**
- **Crons** (chamados via GitHub Actions com `Bearer CRON_SECRET`) **não têm sessão de usuário**. Se usarem `createClient()`, o Supabase usa a anon key com RLS ativo e **todos os writes falham silenciosamente**.
- **Admin routes** também precisam de `createAdminClient()` para writes, pois o RLS bloqueia updates em wallets/transactions de outros usuários mesmo para admins autenticados.
- **Padrão correto para crons:** verificar auth pelo header → criar `createAdminClient()` → todas as operações de DB com o admin client.
- **Padrão correto para admin routes:** verificar auth com `createClient()` + `getUser()` → criar `createAdminClient()` → todas as escritas com o admin client.

```typescript
// ✅ CORRETO — cron sem sessão
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const supabase = createAdminClient(); // nunca createClient() em cron
  // ... todas as operações com supabase
}

// ✅ CORRETO — admin route com sessão
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(); // auth check
  const { data: profile } = await supabase.from("profiles").select("is_admin")...
  if (!profile?.is_admin) return 403;
  const admin = createAdminClient(); // writes com admin client
  await admin.from("wallets").update(...); // ✅ bypassa RLS
}

// ❌ ERRADO — cron usando createClient() para writes
const supabase = await createClient(); // anon key, RLS bloqueia writes
await supabase.from("topics").update(...); // falha silenciosamente
```

**Histórico do bug:** todos os crons usavam `createClient()` para writes. O `oracle_retry_count` nunca era incrementado (write bloqueado pelo RLS), então o oracle ficava preso em `tentativa=1` para sempre e nunca atingia `MAX_RETRIES` para reembolsar. Corrigido em v2.0.1.

### Data Types
Todos os tipos do banco estão em `types/database.ts`. Tipos-chave: `Topic`, `Bet`, `BetMatch`, `Profile`, `Wallet`, `Transaction`, `Friendship`, `PrivateBetInvite`, `Notification`.

Enums:
- `TopicStatus`: `pending` → `active` → `resolving` → `resolved` | `cancelled`. Não existe `closed`.
- `BetSide`: `sim` | `nao` (Português)
- `TopicCategory`: `politica` | `esportes` | `cultura` | `economia` | `tecnologia` | `entretenimento` | `outros`

### Platform Model (v2.0 — pós CMN 5.298/2026)

**Z$ é moeda virtual** — nunca conversível a dinheiro real diretamente. Usuários recebem Z$ ao se cadastrar e participar. Dinheiro real só aparece em:
1. **Concurso Mensal** — ranking por saldo ZC$ no mês → premiação em BRL via PIX (conta bancária no perfil)
2. **Premium** — assinatura mensal (em desenvolvimento)

**Vocabulário obrigatório na UI:**
- aposta/apostar → **palpite/palpitar**
- mercado preditivo → **evento**
- odds → **probabilidade**
- depósito/saque → NUNCA use esses termos na UI

### Três Pilares de Conteúdo

**1. Liga** (`/liga`, `app/(main)/liga/`) — eventos de qualquer categoria exceto economia
- Feed principal da plataforma; mostra `ConcursoBanner` no topo
- Cards direcionam para `/topicos/[id]` (mesma engine de eventos)
- `TopicFilters` com `excludeCategory="economia"` para não mostrar indicadores

**2. Econômico** (`/economico`, `app/(main)/economico/`) — apenas `category = "economia"`
- Indicadores: IPCA, Selic, PIB, câmbio, desemprego
- Admin-curado; sem filtro de categoria (todos são economia)

**3. Privadas** (`/apostas-privadas`) — bolões entre amigos (inalterado)

### Concurso Mensal

- Cada participante inscrito recebe **1.000 ZC$ (Zafes do Concurso)** — carteira separada, exclusiva do concurso
- Palpitam em qualquer evento da Liga com esses ZC$
- Eventos resolvem normalmente — quem acertou recebe da pool dos errados
- Fim do mês: ranking por saldo ZC$ atual (quem começou com 1.000 e chegou mais longe)
- Ranking visível na página da Liga; clica no usuário → vê histórico de palpites (ganhos/perdidos)
- Vencedores recebem BRL via PIX (conta bancária cadastrada no perfil do usuário)
- DB: `concursos`, `inscricoes_concurso`, `concurso_wallets`, `concurso_bets` (a criar)
- `ConcursoBanner` no topo de `/liga` com botão de inscrição

### Tópicos (engine de eventos — shared entre Liga e Econômico)
- `app/(main)/topicos/` ainda existe (acesso direto + redirects de /liga e /economico)
- Criação: `POST /api/criar`, status `pending` até admin aprovar
- Resolução: AI oracle (`lib/oracles/`) → reembolso automático após 3 tentativas INCERTO
- Payout: 6% comissão da plataforma, 94% para vencedores (parimutuel)
- Slug URLs: `/topicos/[slug-or-uuid]` — lookup aceita ambos

### Business Logic (`/lib`)
- `odds.ts` — Parimutuel: `calcOdds(volumeSim, volumeNao)`. **6% comissão**.
- `order-matching.ts` — Mercado secundário: FIFO price-time matching, **6% comissão sobre vendedor**.
- `private-bets.ts` — Resolução P2P: supermaioria 67% por lado.
- `webpush.ts` — `sendPushToUser(userId, payload)` via VAPID; auto-limpa subscriptions stale.
- `oracles/` — Agentes Anthropic por categoria. Pipeline: API fixa → auto-detect → Claude AI triple-check → retry → reembolso.
- `payout.ts` — `pagarVencedores()`, `reembolsarTodos()`. Sempre recebe o client como parâmetro — **passar sempre `adminClient`**.
- `auto-replenish.ts` — `replenishMarkets(supabase)` mantém 15 eventos grandes + 15 pequenos ativos.
- `slugify.ts`, `utils.ts`, `financeiro.ts`

### Oracle — Pipeline de Resolução

`lib/oracles/index.ts` orquestra 4 camadas:
1. **API fixa** por categoria via `oracle_api_id` (grátis, mais confiável)
2. **Auto-detect** por categoria (ex: "dólar" → PTAX)
3. **Claude Haiku** com web search — `oracleAITripleCheck()` faz 2 checks independentes
4. **Retry em 2h, máx 3 tentativas** → após 3 INCERTO → `reembolsarTodos()`

**`MAX_RETRIES = 3`** em `lib/oracles/index.ts`. Após 3 tentativas, reembolso automático.

Oracle JSON parse: `extractResultadoJson()` em `ai-triple-check.ts` e `resolver-direto/route.ts` — tenta parse direto, depois itera matches `{[^{}]+}`, depois regex literal. Usa `client.beta.messages.create` com `betas: ["web-search-2025-03-05"]`, `max_tokens: 1024`.

### Key Database Views & Tables
- `v_topic_stats` — stats por evento: `volume_sim`, `volume_nao`, `total_volume`, `prob_sim`, `prob_nao`, `bet_count`
- `topic_snapshots` — snapshots históricos de prob/volume para o gráfico
- `orders` — ordens do mercado secundário (`topic_id`)
- `trades` — trades executados (`topic_id`)
- `resolucoes` — log de cada tentativa do oracle (campos `check1_*`, `check2_*`)

### Wallet Flow
- Z$ virtual — earned via onboarding bonus, weekly bonus, concurso prizes
- **Mercado primário:** débito na criação do palpite (optimistic lock)
- **Mercado secundário:** balance validado na ordem, **débito só na execução do trade**
- Tipos de transação: `bet_placed`, `bet_won`, `bet_refund`, `commission`
- Todas as mutações usam optimistic locking para prevenir double-spend
- **Sem depositar/sacar** — Z$ não tem valor monetário real direto

### Crons (GitHub Actions — `.github/workflows/cron.yml`)

Rodam a cada hora via `Bearer CRON_SECRET`. **Todos devem usar `createAdminClient()`** (ver regra acima).

| Cron | Rota | Frequência |
|---|---|---|
| Fechar mercados + snapshots | `POST /api/cron/fechar-mercados` | Horária |
| Resolver oracle | `POST /api/cron/resolver-oracle` | Horária |
| Repor mercados | `GET /api/cron/repor-mercados` | Horária |
| Timeout apostas privadas | `POST /api/cron/apostas-privadas-timeout` | Horária |
| Bônus semanal | `POST /api/cron/bonus-semanal` | Segunda 9h UTC |
| Agente de notícias | `POST /api/cron/news-agent` | 11h UTC (8h Brasília) |

### Notifications
Dois canais: insert em `notifications` (in-app) + `sendPushToUser()` (Web Push). Não-bloqueante via `Promise.allSettled`.

### Styling
Dark theme (black bg). Verde primário `#86efac`. Lados do palpite: `--sim` (verde) e `--nao` (vermelho). Componentes usam `cn()` de `lib/utils.ts`.

### Mercado Secundário (Order Book)
- `GET /api/topicos/[id]/orderbook`, `POST/DELETE /api/topicos/[id]/ordem/[orderId]`
- Matching via `lib/order-matching.ts`
- UI: `MercadoSecundario`, `ProbabilityChart`, `LiveStats`

### SEO / Sitemap
- `app/sitemap.xml/route.ts` — inclui topics e perfis públicos
- `app/robots.ts` — permite `/liga/`, `/economico/`, `/topicos/`, `/u/`, `/ranking`, `/historico`
- Deploy: `zafe-rho.vercel.app`. **Sem GitHub auto-deploy — usar `npx vercel --prod`.**

### OG Image
- `GET /api/og?id=[uuid]` — 1200×630 via `next/og` (edge runtime)

### Ligas (Grupos de Amigos)
- Pública (join via botão) e Privada (invite-only). Sub-ligas suportadas.
- DB: `ligas.is_public`, `ligas.parent_liga_id`
- API: `POST /api/ligas/criar`, `POST /api/ligas/entrar`, `GET /api/ligas/publicas`, `GET /api/ligas/buscar-usuarios`

### News Agent
- `POST /api/cron/news-agent` — Anthropic SDK com `web_search_20250305`; gera 5-8 tópicos pendentes diários
- Requer `SYSTEM_USER_ID` env var

### Onboarding Modal
- `components/onboarding/WelcomeModal.tsx` — 3 etapas: boas-vindas → tópico em destaque → confetti
- Usa `localStorage.onboarding_done`; integrado em `app/(main)/layout.tsx`

### Versioning Policy
- **Major features** → nova git tag: `v2.0`, `v2.1`, etc.
- **Small fixes** → edição in-place na versão atual.
- Versão atual: **v2.0.1** — Pivot pós CMN 5.298/2026 (Liga + Econômico, desafios removidos, Z$ virtual) + correção sistêmica do bug de RLS em todos os crons e rotas admin (todos agora usam `createAdminClient()` para writes).

### Language
Todo texto de UI, nomes de rota, variáveis e conteúdo voltado ao usuário em **Português Brasileiro (pt-BR)**.
