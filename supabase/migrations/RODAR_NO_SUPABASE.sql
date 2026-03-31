-- ============================================================
-- ZAFE — Schema Inicial
-- ============================================================

-- ENUMS
CREATE TYPE topic_category AS ENUM ('politica','esportes','cultura','economia','tecnologia','entretenimento','outros');
CREATE TYPE topic_status AS ENUM ('pending','active','resolved','cancelled');
CREATE TYPE topic_resolution AS ENUM ('sim','nao');
CREATE TYPE bet_side AS ENUM ('sim','nao');
CREATE TYPE bet_status AS ENUM ('pending','matched','partial','won','lost','refunded');
CREATE TYPE transaction_type AS ENUM ('deposit','withdraw','bet_placed','bet_won','bet_refund','commission');
CREATE TYPE friendship_status AS ENUM ('pending','accepted','blocked');
CREATE TYPE invite_status AS ENUM ('pending','accepted','declined','expired');
CREATE TYPE notification_type AS ENUM ('bet_invite','bet_matched','market_resolved','friend_request','bet_won');

-- PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALLETS
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOPICS
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 120),
  description TEXT NOT NULL CHECK (char_length(description) <= 500),
  category topic_category NOT NULL DEFAULT 'outros',
  status topic_status NOT NULL DEFAULT 'pending',
  resolution topic_resolution,
  min_bet NUMERIC(12,2) DEFAULT 1.00,
  closes_at TIMESTAMPTZ NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOPIC SNAPSHOTS (histórico para gráfico)
CREATE TABLE topic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  prob_sim NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  volume_sim NUMERIC(12,2) DEFAULT 0,
  volume_nao NUMERIC(12,2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- BETS
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  side bet_side NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status bet_status NOT NULL DEFAULT 'pending',
  matched_amount NUMERIC(12,2) DEFAULT 0,
  unmatched_amount NUMERIC(12,2) DEFAULT 0,
  potential_payout NUMERIC(12,2) DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BET MATCHES
CREATE TABLE bet_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  sim_bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  nao_bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  matched_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FRIENDSHIPS
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- PRIVATE BET INVITES
CREATE TABLE private_bet_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inviter_side bet_side NOT NULL,
  invitee_side bet_side NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  payload JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW v_topic_stats AS
SELECT
  t.id AS topic_id,
  COALESCE(SUM(CASE WHEN b.side = 'sim' THEN b.matched_amount ELSE 0 END), 0) AS volume_sim,
  COALESCE(SUM(CASE WHEN b.side = 'nao' THEN b.matched_amount ELSE 0 END), 0) AS volume_nao,
  COALESCE(SUM(b.matched_amount), 0) AS total_volume,
  CASE
    WHEN COALESCE(SUM(b.matched_amount), 0) = 0 THEN 0.5
    ELSE COALESCE(SUM(CASE WHEN b.side = 'sim' THEN b.matched_amount ELSE 0 END), 0)
         / COALESCE(SUM(b.matched_amount), 1)
  END AS prob_sim,
  CASE
    WHEN COALESCE(SUM(b.matched_amount), 0) = 0 THEN 0.5
    ELSE COALESCE(SUM(CASE WHEN b.side = 'nao' THEN b.matched_amount ELSE 0 END), 0)
         / COALESCE(SUM(b.matched_amount), 1)
  END AS prob_nao,
  COUNT(DISTINCT b.id) AS bet_count
FROM topics t
LEFT JOIN bets b ON b.topic_id = t.id AND b.status NOT IN ('refunded')
GROUP BY t.id;

-- ============================================================
-- TRIGGER: criar profile + wallet após signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    _username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', _username),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_bet_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets
CREATE POLICY "wallets_own" ON wallets FOR ALL USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "transactions_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_service_insert" ON transactions FOR INSERT WITH CHECK (true);

-- Topics
CREATE POLICY "topics_public_read" ON topics FOR SELECT USING (status = 'active' OR creator_id = auth.uid());
CREATE POLICY "topics_authenticated_insert" ON topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "topics_service_update" ON topics FOR UPDATE USING (true);

-- Topic Snapshots
CREATE POLICY "snapshots_public_read" ON topic_snapshots FOR SELECT USING (true);
CREATE POLICY "snapshots_service_insert" ON topic_snapshots FOR INSERT WITH CHECK (true);

-- Bets
CREATE POLICY "bets_own_read" ON bets FOR SELECT USING (auth.uid() = user_id OR is_private = false);
CREATE POLICY "bets_service_insert" ON bets FOR INSERT WITH CHECK (true);
CREATE POLICY "bets_service_update" ON bets FOR UPDATE USING (true);

-- Bet Matches
CREATE POLICY "bet_matches_read" ON bet_matches FOR SELECT USING (true);
CREATE POLICY "bet_matches_service_insert" ON bet_matches FOR INSERT WITH CHECK (true);

-- Friendships
CREATE POLICY "friendships_own" ON friendships FOR ALL USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Private Bet Invites
CREATE POLICY "invites_own" ON private_bet_invites FOR ALL USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Comments
CREATE POLICY "comments_public_read" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_authenticated_insert" ON comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "comments_own_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_topics_status ON topics(status);
CREATE INDEX idx_topics_category ON topics(category);
CREATE INDEX idx_topics_closes_at ON topics(closes_at);
CREATE INDEX idx_bets_topic_id ON bets(topic_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bet_matches_topic_id ON bet_matches(topic_id);
CREATE INDEX idx_comments_topic_id ON comments(topic_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, read);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_friendships_users ON friendships(requester_id, addressee_id);
-- Remove trigger e função antiga
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recriar função mais robusta
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _full_name TEXT;
  _avatar_url TEXT;
  _suffix INT := 0;
  _final_username TEXT;
BEGIN
  -- Extrair dados do metadata (email/senha e Google OAuth)
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Gerar username: pegar base do metadata ou email, sanitizar
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    regexp_replace(
      lower(split_part(NEW.email, '@', 1)),
      '[^a-z0-9_]', '', 'g'
    )
  );

  -- Garantir que username não seja vazio
  IF _username = '' OR _username IS NULL THEN
    _username := 'user';
  END IF;

  -- Truncar se muito longo
  _username := left(_username, 20);

  -- Resolver conflito de username com sufixo numérico
  _final_username := _username;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE username = _final_username
    );
    _suffix := _suffix + 1;
    _final_username := left(_username, 16) || _suffix::TEXT;
  END LOOP;

  -- Inserir perfil (ignora se já existir pelo id)
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (NEW.id, _final_username, _full_name, _avatar_url)
  ON CONFLICT (id) DO NOTHING;

  -- Inserir carteira zerada (ignora se já existir)
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Logar o erro mas não bloquear a criação do usuário
  RAISE WARNING 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- ============================================================
-- LIGAS — Grupos privados de investimento entre amigos
-- ============================================================

CREATE TABLE ligas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  description TEXT CHECK (char_length(description) <= 200),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#86efac',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE liga_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, user_id)
);

-- Adicionar liga_id aos tópicos
ALTER TABLE topics ADD COLUMN IF NOT EXISTS liga_id UUID REFERENCES ligas(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE ligas ENABLE ROW LEVEL SECURITY;
ALTER TABLE liga_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ligas_member_read" ON ligas FOR SELECT
  USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM liga_members WHERE liga_id = ligas.id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "ligas_creator_insert" ON ligas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ligas_creator_update" ON ligas FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "liga_members_read" ON liga_members FOR SELECT
  USING (
    user_id = auth.uid() OR invited_by = auth.uid() OR
    EXISTS (SELECT 1 FROM ligas WHERE id = liga_id AND creator_id = auth.uid())
  );

CREATE POLICY "liga_members_insert" ON liga_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "liga_members_update" ON liga_members FOR UPDATE
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM ligas WHERE id = liga_id AND creator_id = auth.uid()));

-- Índices
CREATE INDEX idx_liga_members_liga_id ON liga_members(liga_id);
CREATE INDEX idx_liga_members_user_id ON liga_members(user_id);
CREATE INDEX idx_topics_liga_id ON topics(liga_id);
-- Recriar view para incluir todos os status de apostas no volume
DROP VIEW IF EXISTS v_topic_stats;

CREATE VIEW v_topic_stats AS
SELECT
  t.id AS topic_id,
  COALESCE(SUM(CASE WHEN b.side = 'sim' THEN b.amount ELSE 0 END), 0) AS volume_sim,
  COALESCE(SUM(CASE WHEN b.side = 'nao' THEN b.amount ELSE 0 END), 0) AS volume_nao,
  COALESCE(SUM(b.amount), 0) AS total_volume,
  CASE
    WHEN COALESCE(SUM(b.amount), 0) = 0 THEN 0.5
    ELSE ROUND(
      COALESCE(SUM(CASE WHEN b.side = 'sim' THEN b.amount ELSE 0 END), 0)
      / NULLIF(COALESCE(SUM(b.amount), 0), 0),
    4)
  END AS prob_sim,
  CASE
    WHEN COALESCE(SUM(b.amount), 0) = 0 THEN 0.5
    ELSE ROUND(
      COALESCE(SUM(CASE WHEN b.side = 'nao' THEN b.amount ELSE 0 END), 0)
      / NULLIF(COALESCE(SUM(b.amount), 0), 0),
    4)
  END AS prob_nao,
  COUNT(DISTINCT b.id) AS bet_count
FROM topics t
LEFT JOIN bets b ON b.topic_id = t.id AND b.status NOT IN ('refunded')
GROUP BY t.id;
-- Add locked_odds and gross_amount to bets
ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS locked_odds NUMERIC(10,4) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2);

-- Add title/body/data to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS "data" JSONB DEFAULT '{}';

-- Index for double-side prevention
CREATE INDEX IF NOT EXISTS idx_bets_user_topic_side
  ON bets(user_id, topic_id, side)
  WHERE status NOT IN ('refunded','lost');
-- ============================================================
-- ZAFE — Oracle System
-- ============================================================

-- Adiciona status 'resolving' ao enum
ALTER TYPE topic_status ADD VALUE IF NOT EXISTS 'resolving';

-- Colunas oracle nos topics
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS oracle_api_id TEXT,
  ADD COLUMN IF NOT EXISTS oracle_retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oracle_next_retry_at TIMESTAMPTZ;

-- Tabela de auditoria de resoluções
CREATE TABLE IF NOT EXISTS resolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercado_id UUID REFERENCES topics(id) ON DELETE CASCADE,

  -- Camada utilizada
  resolvido_por TEXT, -- 'api_fixa' | 'oracle_ai' | 'reembolso' | 'pendente'
  oracle_usado TEXT,  -- ex: 'api-futebol.com.br' | 'claude-ai'
  numero_tentativa INT,

  -- Resultados do AI triple-check (quando usado)
  check1_resultado TEXT,
  check1_fonte TEXT,
  check1_confianca INT,
  check2_resultado TEXT,
  check2_fonte TEXT,
  check2_confianca INT,
  check3_resultado TEXT,
  check3_fonte TEXT,
  check3_confianca INT,

  -- Decisão final
  resultado_final TEXT, -- 'SIM' | 'NAO' | 'REEMBOLSO' | 'INCERTO'

  resolvido_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para resolucoes (só admin lê/escreve via service role)
ALTER TABLE resolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver resolucoes"
  ON resolucoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Index para buscar resolucoes por mercado
CREATE INDEX IF NOT EXISTS idx_resolucoes_mercado ON resolucoes(mercado_id);

-- Index para cron: encontrar topics resolving prontos para retry
CREATE INDEX IF NOT EXISTS idx_topics_resolving
  ON topics(status, oracle_next_retry_at)
  WHERE status = 'resolving';
-- ============================================================
-- ZAFE — Sistema de Apostas Privadas em Grupo
-- ============================================================

-- Fase da aposta privada
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS private_phase TEXT
    CHECK (private_phase IN (
      'recruiting','leader_election','judge_negotiation',
      'judge_confirmation','active','voting','voting_round2',
      'resolved','cancelled'
    )),
  ADD COLUMN IF NOT EXISTS recruitment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leader_election_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiation_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS judge_vote_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_participants INT DEFAULT 5;

-- ── Lados da aposta (A = SIM, B = NAO) ──────────────────────
CREATE TABLE IF NOT EXISTS topic_sides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL CHECK (side IN ('A','B')),
  leader_id UUID REFERENCES profiles(id),
  leader_elected_at TIMESTAMPTZ,
  UNIQUE(topic_id, side)
);

-- ── Participantes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  side CHAR(1) NOT NULL CHECK (side IN ('A','B')),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','accepted','declined','expired')),
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ,
  UNIQUE(topic_id, user_id)
);

-- ── Votos para eleição de líder ──────────────────────────────
CREATE TABLE IF NOT EXISTS leader_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL,
  voter_id UUID NOT NULL REFERENCES profiles(id),
  candidate_id UUID NOT NULL REFERENCES profiles(id),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, side, voter_id)
);

-- ── Nomeações de juízes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS judge_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES profiles(id),
  proposed_by_side CHAR(1) NOT NULL,
  -- aprovações de cada líder (null=pendente, true=aceito, false=rejeitado)
  leader_a_approved BOOLEAN,
  leader_b_approved BOOLEAN,
  -- se este juiz substitui outro rejeitado
  replaces_id UUID REFERENCES judge_nominations(id),
  -- status geral
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','both_approved','active','rejected','declined')),
  -- prazo para o outro lado responder (24h)
  response_deadline TIMESTAMPTZ,
  -- prazo para o juiz confirmar disponibilidade (12h)
  availability_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Votos dos juízes sobre o resultado ──────────────────────
CREATE TABLE IF NOT EXISTS judge_outcome_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES profiles(id),
  vote TEXT CHECK (vote IN ('sim','nao')),
  round INT NOT NULL DEFAULT 1,
  voted_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  UNIQUE(topic_id, judge_id, round)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE topic_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_outcome_votes ENABLE ROW LEVEL SECURITY;

-- topic_sides: participantes do topic podem ver
CREATE POLICY "Participantes veem lados" ON topic_sides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM topic_participants
    WHERE topic_participants.topic_id = topic_sides.topic_id
    AND topic_participants.user_id = auth.uid()
    AND topic_participants.status = 'accepted'
  ));

-- topic_participants: todos os membros e o criador podem ver
CREATE POLICY "Membros veem participantes" ON topic_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM topic_participants tp2
      WHERE tp2.topic_id = topic_participants.topic_id
      AND tp2.user_id = auth.uid()
      AND tp2.status = 'accepted'
    )
  );

-- leader_votes: só o próprio voto
CREATE POLICY "Cada um ve seu voto" ON leader_votes FOR SELECT
  USING (voter_id = auth.uid());

-- judge_nominations: participantes e o próprio juiz podem ver
CREATE POLICY "Membros veem nomeacoes" ON judge_nominations FOR SELECT
  USING (
    judge_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM topic_participants
      WHERE topic_participants.topic_id = judge_nominations.topic_id
      AND topic_participants.user_id = auth.uid()
      AND topic_participants.status = 'accepted'
    )
  );

-- judge_outcome_votes: participantes podem ver (para auditar)
CREATE POLICY "Participantes veem votos resultado" ON judge_outcome_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM topic_participants
    WHERE topic_participants.topic_id = judge_outcome_votes.topic_id
    AND topic_participants.user_id = auth.uid()
    AND topic_participants.status = 'accepted'
  ));

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_topic_participants_topic ON topic_participants(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_user ON topic_participants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_nominations_topic ON judge_nominations(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_outcome_votes_topic ON judge_outcome_votes(topic_id, round);
CREATE INDEX IF NOT EXISTS idx_topics_private_phase
  ON topics(private_phase, recruitment_deadline, negotiation_deadline, judge_vote_deadline)
  WHERE is_private = TRUE;

-- ============================================================
-- push_subscriptions (Web Push Notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- ============================================================
-- KYC — CPF no profiles (se ainda não existir)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Referrals
-- ============================================================
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
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Gerar referral_code automático para novos usuários
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := lower(substring(md5(NEW.id::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- Atualizar profiles existentes que não têm referral_code
UPDATE profiles SET referral_code = lower(substring(md5(id::text) from 1 for 8))
WHERE referral_code IS NULL;
