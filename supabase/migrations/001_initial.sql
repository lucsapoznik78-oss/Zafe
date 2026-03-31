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
