-- ============================================================
-- ZAFE — Migration 021: Remaining missing tables (reproducibility #4)
-- ============================================================
-- Junto com a 005 (tabelas do Concurso), completa a reprodutibilidade do
-- schema. Estas tabelas eram usadas pelo código mas nunca criadas por
-- nenhuma migration numerada — só existiam em produção via scripts avulsos.
-- Diferente das tabelas de Concurso, NENHUMA migration as referencia por FK,
-- então podem ser criadas no fim da sequência sem quebrar a ordem.
--
-- Tudo com CREATE TABLE / ADD COLUMN IF NOT EXISTS → no-op idempotente em
-- produção (onde já existem) e reproduzível do zero.

-- ── Zafe Comunidade (Pilar 5) ───────────────────────────────────
-- Reputação do criador (gate para criar eventos; score 0–100).
CREATE TABLE IF NOT EXISTS creator_reputation (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL DEFAULT 100,
  events_created INTEGER NOT NULL DEFAULT 0,
  events_resolved INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos criados pela comunidade.
CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'outros',
  status TEXT NOT NULL DEFAULT 'active',
    -- active | awaiting_resolution | community_resolved | contested | reversed | resolved | cancelled
  closes_at TIMESTAMPTZ NOT NULL,
  resolution_deadline TIMESTAMPTZ,
  resolution TEXT,                          -- sim | nao (nulo até resolver)
  resolved_at TIMESTAMPTZ,
  creator_commission NUMERIC(12,2) DEFAULT 0,
  contestation_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  total_volume NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Palpites nos eventos da comunidade (parimutuel Z$ principal).
CREATE TABLE IF NOT EXISTS community_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  side bet_side NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  locked_odds NUMERIC(8,4),
  potential_payout NUMERIC(12,2),
  status bet_status NOT NULL DEFAULT 'matched',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contestações da resolução comunitária (taxa Z$10, gatilho dos 30%).
CREATE TABLE IF NOT EXISTS community_contestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  fee_charged NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- Snapshots de probabilidade dos eventos da comunidade (gráfico).
CREATE TABLE IF NOT EXISTS community_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  prob_sim NUMERIC(5,4) DEFAULT 0.5,
  volume_sim NUMERIC(12,2) DEFAULT 0,
  volume_nao NUMERIC(12,2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_bets_event ON community_bets(event_id);
CREATE INDEX IF NOT EXISTS idx_community_events_status ON community_events(status);
CREATE INDEX IF NOT EXISTS idx_community_snapshots_event ON community_snapshots(event_id, recorded_at);

-- View de stats agregadas por evento (volume por lado + probabilidade).
DROP VIEW IF EXISTS v_community_event_stats;
CREATE VIEW v_community_event_stats AS
SELECT
  cb.event_id,
  COALESCE(SUM(CASE WHEN cb.side = 'sim' THEN cb.amount ELSE 0 END), 0) AS volume_sim,
  COALESCE(SUM(CASE WHEN cb.side = 'nao' THEN cb.amount ELSE 0 END), 0) AS volume_nao,
  COALESCE(SUM(cb.amount), 0) AS total_volume,
  COUNT(DISTINCT cb.user_id) AS bet_count,
  CASE
    WHEN COALESCE(SUM(cb.amount), 0) = 0 THEN 0.5
    ELSE COALESCE(SUM(CASE WHEN cb.side = 'sim' THEN cb.amount ELSE 0 END), 0)
         / NULLIF(SUM(cb.amount), 0)
  END AS prob_sim
FROM community_bets cb
WHERE cb.status NOT IN ('refunded', 'lost')
GROUP BY cb.event_id;

-- ── Web Push ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ── Referrals ───────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  bonus_paid_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);

-- ── Desafios (palpites privados via order book) ─────────────────
-- NOTA: a tabela-pai `desafios` não pôde ser reconstruída a partir do código
-- com confiança (nenhuma rota de criação/DDL encontrada). `desafio_bets` é
-- criada best-effort com as colunas observadas em lib/order-matching.ts;
-- `desafio_id` fica sem FK. As colunas desafio_id em orders/trades são
-- adicionadas de forma aditiva. Validar contra produção antes de confiar.
CREATE TABLE IF NOT EXISTS desafio_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  side bet_side NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  locked_odds NUMERIC(8,4),
  potential_payout NUMERIC(12,2),
  status bet_status NOT NULL DEFAULT 'matched',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_desafio_bets_desafio ON desafio_bets(desafio_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS desafio_id UUID;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS desafio_id UUID;
