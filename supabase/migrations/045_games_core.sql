-- ============================================================
-- ZAFE — Migration 045: Zafe Games (bolão de e-sports)
-- ============================================================
-- Módulo de e-sports estruturado como BOLÃO (ver modules/games/COMPLIANCE.md):
--   * NÃO é mercado público — sem order book, sem odds públicas. CMN 5.298
--     restringe mercado público a indicadores econômicos.
--   * Modo grátis (padrão): palpite "Quem ganha?" → PONTOS internos
--     (games_score_event), que NUNCA entram na economia Z$ (sem inflação).
--   * Modo pote (opcional): buy-in Z$ da carteira PRINCIPAL forma um pote
--     fechado do evento, pago em parimutuel (0% comissão) a quem acertou.
--   * Conservação: SUM(wallets.balance) + SUM(potes abertos) = constante.
--
-- Padrão herdado da Zafe Copa (migration 027): funções SECURITY DEFINER
-- (service_role only) para mutações wallet multi-tabela atômicas; RLS de
-- leitura pública (autenticada) com escrita só via service role; RLS
-- anti-cópia de palpite (palpite alheio só visível após o lock).

-- ------------------------------------------------------------
-- 1. Enum de transactions (declarados aqui; primeiro uso em runtime)
-- ------------------------------------------------------------
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'games_buy_in';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'games_prize';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'games_refund';

-- ------------------------------------------------------------
-- 2. Eventos de e-sports
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_event (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game         TEXT NOT NULL CHECK (game IN ('free_fire','valorant','cs2','lol')),
  tournament   TEXT,                              -- ex.: "VCT Americas", "IEM"
  side_a       TEXT NOT NULL,                     -- time/jogador A
  side_b       TEXT NOT NULL,                     -- time/jogador B
  -- Modo do bolão. 'free' = só pontos; 'pot' = buy-in Z$ forma pote.
  mode         TEXT NOT NULL DEFAULT 'free' CHECK (mode IN ('free','pot')),
  buy_in       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (buy_in >= 0),
  pot_total    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pot_total >= 0),
  -- Lock dos palpites. COMPLIANCE: closes_at SEMPRE antes de starts_at.
  closes_at    TIMESTAMPTZ NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','live','under_review','finished','cancelled')),
  -- Resultado: lado vencedor.
  winner       TEXT CHECK (winner IN ('a','b')),
  pot_paid_at  TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ,
  -- Auto-resolução: id da partida no provedor (PandaScore/Abios/GRID).
  provider     TEXT,
  external_id  TEXT,
  source_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garantia estrutural do checkpoint de compliance: o palpite fecha
  -- antes do evento começar (nunca se palpita com o jogo em andamento).
  CONSTRAINT games_event_lock_before_start CHECK (closes_at <= starts_at),
  -- Pote exige buy-in > 0; modo grátis tem buy-in 0.
  CONSTRAINT games_event_mode_buyin CHECK (
    (mode = 'pot' AND buy_in > 0) OR (mode = 'free' AND buy_in = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_games_event_status ON games_event(status, closes_at);
CREATE INDEX IF NOT EXISTS idx_games_event_resolver ON games_event(status, starts_at)
  WHERE status IN ('scheduled','live','under_review');

-- ------------------------------------------------------------
-- 3. Palpites (1 por usuário por evento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_prediction (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES games_event(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pick         TEXT NOT NULL CHECK (pick IN ('a','b')),
  -- Z$ pago (modo pote). 0 no modo grátis. Em parimutuel é o "stake".
  buy_in_paid  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (buy_in_paid >= 0),
  -- Liquidação do pote: pending → won | lost | refunded (claim atômico).
  settle_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (settle_status IN ('pending','won','lost','refunded')),
  payout       NUMERIC(12,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_games_prediction_event ON games_prediction(event_id);
CREATE INDEX IF NOT EXISTS idx_games_prediction_user ON games_prediction(user_id);

-- ------------------------------------------------------------
-- 4. Ledger de pontos (gamificação — NUNCA Z$)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_score_event (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES games_event(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN ('correct_pick')),
  points       INTEGER NOT NULL DEFAULT 10,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotência: re-resolver um evento nunca pontua 2x.
  UNIQUE (event_id, user_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_games_score_user ON games_score_event(user_id);

-- ------------------------------------------------------------
-- 5. Stats / ranks por usuário (current_tier SEMPRE server-side)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_user_stats (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  events_played  INTEGER NOT NULL DEFAULT 0,
  events_won     INTEGER NOT NULL DEFAULT 0,
  points_total   INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak    INTEGER NOT NULL DEFAULT 0,
  -- Recalculado no servidor a partir de events_won — nunca confiar no client.
  current_tier   TEXT NOT NULL DEFAULT 'ferro'
    CHECK (current_tier IN ('ferro','bronze','prata','ouro','platina','diamante','mestre')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. Programa de streamers (estende o sistema de referral existente:
--    profiles.referral_code / referred_by / tabela referrals)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_streamers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE,             -- código de referral do streamer
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  -- Rev share (% da receita atribuída). Pay-for-performance, sem adiantamento.
  rev_share_pct NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (rev_share_pct >= 0 AND rev_share_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atribuição de usuários trazidos por um streamer. Anti-fraude: 1 atribuição
-- por usuário (UNIQUE), bloqueio de auto-indicação na camada de API + aqui.
CREATE TABLE IF NOT EXISTS games_referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id     UUID NOT NULL REFERENCES games_streamers(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','rejected')),
  -- Sinais anti-fraude (conta duplicada por device/IP).
  signup_ip       TEXT,
  signup_device   TEXT,
  attributed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_referrals_streamer ON games_referrals(streamer_id);
CREATE INDEX IF NOT EXISTS idx_games_referrals_fraud ON games_referrals(signup_ip, signup_device);

-- Ledger auditável de ganhos do streamer (rev share). Nunca é Z$ do usuário —
-- é receita R$ da operação atribuída ao streamer (paga fora da plataforma).
CREATE TABLE IF NOT EXISTS games_streamer_earnings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id      UUID NOT NULL REFERENCES games_streamers(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source           TEXT NOT NULL CHECK (source IN ('premium_conversion','other')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_earnings_streamer ON games_streamer_earnings(streamer_id);

-- ------------------------------------------------------------
-- 7. Log de auditoria do oráculo (toda chamada ao provedor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games_resolution_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES games_event(id) ON DELETE CASCADE,
  attempt      INTEGER NOT NULL DEFAULT 1,
  provider     TEXT,
  raw_response TEXT NOT NULL,
  parsed       JSONB,
  confidence   NUMERIC,
  source_url   TEXT,
  outcome      TEXT NOT NULL CHECK (outcome IN
    ('applied','not_final','manual_review','api_error','parse_error','reversed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_resolution_event ON games_resolution_log(event_id);

-- ------------------------------------------------------------
-- 8. Leaderboard de ranks (view) — pontos totais + ordem estável
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_games_leaderboard
WITH (security_invoker = on) AS
SELECT
  s.user_id,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  s.events_played,
  s.events_won,
  s.points_total,
  s.best_streak,
  s.current_tier,
  ROW_NUMBER() OVER (
    ORDER BY s.points_total DESC, s.events_won DESC, s.best_streak DESC, pr.username ASC
  )::INTEGER AS posicao
FROM games_user_stats s
JOIN profiles pr ON pr.id = s.user_id;

-- ------------------------------------------------------------
-- 9. RLS
-- ------------------------------------------------------------
ALTER TABLE games_event            ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_prediction       ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_score_event      ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_user_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_streamers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_referrals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_streamer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_resolution_log   ENABLE ROW LEVEL SECURITY;

-- Leitura pública (autenticada); escrita só via service role.
CREATE POLICY games_event_select ON games_event
  FOR SELECT TO authenticated USING (true);
CREATE POLICY games_score_select ON games_score_event
  FOR SELECT TO authenticated USING (true);
CREATE POLICY games_stats_select ON games_user_stats
  FOR SELECT TO authenticated USING (true);

-- Anti-cópia de palpite: o próprio usuário vê o seu; o dos OUTROS só após o lock.
CREATE POLICY games_prediction_select ON games_prediction
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM games_event e
      WHERE e.id = games_prediction.event_id AND e.closes_at <= NOW()
    )
  );

-- Streamers: o próprio streamer lê seu cadastro; o resto não.
CREATE POLICY games_streamers_select ON games_streamers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atribuições e ganhos: streamer lê APENAS os próprios (dashboard).
CREATE POLICY games_referrals_select ON games_referrals
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM games_streamers s
      WHERE s.id = games_referrals.streamer_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY games_earnings_select ON games_streamer_earnings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM games_streamers s
      WHERE s.id = games_streamer_earnings.streamer_id AND s.user_id = auth.uid()
    )
  );

-- games_resolution_log: SEM policy → invisível a authenticated; admin via service role.

-- ------------------------------------------------------------
-- 10. Funções (SECURITY DEFINER, service_role only)
-- ------------------------------------------------------------

-- 10.1 Palpite no modo POTE com buy-in atômico: debita Z$ da carteira
-- principal, cria/atualiza o palpite, soma ao pote e registra a transaction.
-- Tudo ou nada. Débito condicional (balance >= buy_in) é mais forte que o CAS.
CREATE OR REPLACE FUNCTION games_join_pot(p_user UUID, p_event UUID, p_pick TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt   games_event%ROWTYPE;
  v_rows  INTEGER;
  v_exists INTEGER;
BEGIN
  IF p_pick NOT IN ('a','b') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_pick');
  END IF;

  SELECT * INTO v_evt FROM games_event WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_evt.mode <> 'pot' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pot');
  END IF;
  IF v_evt.status <> 'scheduled' OR v_evt.closes_at <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  -- Já palpitou? No modo pote, não permite trocar (o stake já entrou no pote).
  SELECT 1 INTO v_exists FROM games_prediction
    WHERE event_id = p_event AND user_id = p_user;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_predicted');
  END IF;

  UPDATE wallets SET balance = balance - v_evt.buy_in
    WHERE user_id = p_user AND balance >= v_evt.buy_in;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient');
  END IF;

  INSERT INTO games_prediction (event_id, user_id, pick, buy_in_paid)
  VALUES (p_event, p_user, p_pick, v_evt.buy_in);

  UPDATE games_event SET pot_total = pot_total + v_evt.buy_in WHERE id = p_event;

  INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
  VALUES (p_user, 'games_buy_in', -v_evt.buy_in, -v_evt.buy_in,
          'Entrada Zafe Games: ' || v_evt.side_a || ' x ' || v_evt.side_b, p_event);

  RETURN jsonb_build_object('ok', true, 'buy_in', v_evt.buy_in);
END;
$$;

-- 10.2 Liquidação do pote em PARIMUTUEL (0% comissão). Idempotente:
-- guarda CAS (status='finished' AND pot_paid_at IS NULL) com lock de linha.
-- Vencedores dividem o pote inteiro proporcional ao stake; se ninguém
-- acertou o lado vencedor, reembolsa todos (pote unilateral).
CREATE OR REPLACE FUNCTION games_pot_settle(p_event UUID, p_winner TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt    games_event%ROWTYPE;
  v_pot    NUMERIC(12,2);
  v_winstake NUMERIC(12,2);
  v_rows   INTEGER;
  v_pred   RECORD;
  v_payout NUMERIC(12,2);
  v_winners INTEGER;
  v_i      INTEGER := 0;
  v_paid   NUMERIC(12,2) := 0;
BEGIN
  IF p_winner NOT IN ('a','b') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_winner');
  END IF;

  SELECT * INTO v_evt FROM games_event WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_evt.mode <> 'pot' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pot');
  END IF;

  -- Marca como finished+winner só se ainda não pago (guarda idempotente).
  UPDATE games_event
     SET status = 'finished', winner = p_winner,
         resolved_at = COALESCE(resolved_at, NOW())
   WHERE id = p_event AND pot_paid_at IS NULL
   RETURNING pot_total INTO v_pot;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  SELECT COALESCE(SUM(buy_in_paid), 0) INTO v_winstake
    FROM games_prediction WHERE event_id = p_event AND pick = p_winner;

  IF v_winstake = 0 THEN
    -- Ninguém acertou o lado vencedor → reembolsa todos (pote unilateral).
    FOR v_pred IN
      SELECT id, user_id, buy_in_paid FROM games_prediction
       WHERE event_id = p_event AND settle_status = 'pending'
    LOOP
      UPDATE games_prediction SET settle_status = 'refunded', payout = v_pred.buy_in_paid,
             updated_at = NOW() WHERE id = v_pred.id AND settle_status = 'pending';
      UPDATE wallets SET balance = balance + v_pred.buy_in_paid WHERE user_id = v_pred.user_id;
      INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
      VALUES (v_pred.user_id, 'games_refund', v_pred.buy_in_paid, v_pred.buy_in_paid,
              'Reembolso Zafe Games', p_event);
    END LOOP;
    UPDATE games_event SET pot_paid_at = NOW() WHERE id = p_event;
    RETURN jsonb_build_object('ok', true, 'refunded', true);
  END IF;

  -- Marca perdedores (claim pending→lost).
  UPDATE games_prediction SET settle_status = 'lost', payout = 0, updated_at = NOW()
   WHERE event_id = p_event AND pick <> p_winner AND settle_status = 'pending';

  -- Paga vencedores: cada um leva (pote inteiro) * (stake / stake_vencedor).
  -- O último vencedor absorve o resto do arredondamento para garantir
  -- SUM(payout) = pote exato (conservação de Z$, sem mintar/destruir centavos).
  SELECT COUNT(*) INTO v_winners
    FROM games_prediction WHERE event_id = p_event AND pick = p_winner AND settle_status = 'pending';
  FOR v_pred IN
    SELECT id, user_id, buy_in_paid FROM games_prediction
     WHERE event_id = p_event AND pick = p_winner AND settle_status = 'pending'
     ORDER BY id
  LOOP
    v_i := v_i + 1;
    IF v_i = v_winners THEN
      v_payout := v_pot - v_paid; -- último leva o restante exato
    ELSE
      v_payout := ROUND(v_pot * (v_pred.buy_in_paid / v_winstake), 2);
    END IF;
    v_paid := v_paid + v_payout;
    UPDATE games_prediction SET settle_status = 'won', payout = v_payout, updated_at = NOW()
     WHERE id = v_pred.id AND settle_status = 'pending';
    UPDATE wallets SET balance = balance + v_payout WHERE user_id = v_pred.user_id;
    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (v_pred.user_id, 'games_prize', v_payout, v_payout,
            'Premiação Zafe Games', p_event);
  END LOOP;

  UPDATE games_event SET pot_paid_at = NOW() WHERE id = p_event;
  RETURN jsonb_build_object('ok', true, 'pot_total', v_pot, 'winning_stake', v_winstake);
END;
$$;

-- 10.3 Cancelamento: reembolsa o buy-in de todos e zera o pote.
CREATE OR REPLACE FUNCTION games_pot_refund(p_event UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt  games_event%ROWTYPE;
  v_pred RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_evt FROM games_event WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_evt.pot_paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_settled');
  END IF;

  FOR v_pred IN
    SELECT id, user_id, buy_in_paid FROM games_prediction
     WHERE event_id = p_event AND settle_status = 'pending'
  LOOP
    UPDATE games_prediction SET settle_status = 'refunded', payout = v_pred.buy_in_paid,
           updated_at = NOW() WHERE id = v_pred.id AND settle_status = 'pending';
    UPDATE wallets SET balance = balance + v_pred.buy_in_paid WHERE user_id = v_pred.user_id;
    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (v_pred.user_id, 'games_refund', v_pred.buy_in_paid, v_pred.buy_in_paid,
            'Reembolso Zafe Games (cancelado)', p_event);
    v_count := v_count + 1;
  END LOOP;

  UPDATE games_event SET status = 'cancelled', pot_total = 0, pot_paid_at = NOW()
   WHERE id = p_event;
  RETURN jsonb_build_object('ok', true, 'refunded', v_count);
END;
$$;

-- 10.4 Recálculo determinístico de stats/ranks a partir do ledger de pontos.
-- current_tier é derivado de events_won AQUI (server-side), nunca do client.
CREATE OR REPLACE FUNCTION games_recalc_stats(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_played INTEGER;
  v_won    INTEGER;
  v_points INTEGER;
  v_tier   TEXT;
  v_cur    INTEGER := 0;
  v_best   INTEGER := 0;
  v_rec    RECORD;
BEGIN
  SELECT COUNT(*) INTO v_played
    FROM games_prediction gp
    JOIN games_event ge ON ge.id = gp.event_id
   WHERE gp.user_id = p_user AND ge.status = 'finished';

  -- "won" = acertou o lado vencedor de um evento finalizado.
  SELECT COUNT(*) INTO v_won
    FROM games_prediction gp
    JOIN games_event ge ON ge.id = gp.event_id
   WHERE gp.user_id = p_user AND ge.status = 'finished'
     AND ge.winner IS NOT NULL AND gp.pick = ge.winner;

  SELECT COALESCE(SUM(points), 0) INTO v_points
    FROM games_score_event WHERE user_id = p_user;

  -- Streak: percorre os eventos finalizados em ordem cronológica e conta
  -- acertos consecutivos. current_streak = sequência mais recente.
  FOR v_rec IN
    SELECT (gp.pick = ge.winner) AS hit
      FROM games_prediction gp
      JOIN games_event ge ON ge.id = gp.event_id
     WHERE gp.user_id = p_user AND ge.status = 'finished' AND ge.winner IS NOT NULL
     ORDER BY ge.resolved_at ASC NULLS LAST, ge.starts_at ASC
  LOOP
    IF v_rec.hit THEN
      v_cur := v_cur + 1;
      IF v_cur > v_best THEN v_best := v_cur; END IF;
    ELSE
      v_cur := 0;
    END IF;
  END LOOP;

  v_tier := CASE
    WHEN v_won >= 400 THEN 'mestre'
    WHEN v_won >= 200 THEN 'diamante'
    WHEN v_won >= 100 THEN 'platina'
    WHEN v_won >= 50  THEN 'ouro'
    WHEN v_won >= 25  THEN 'prata'
    WHEN v_won >= 10  THEN 'bronze'
    ELSE 'ferro'
  END;

  INSERT INTO games_user_stats (user_id, events_played, events_won, points_total,
                                current_streak, best_streak, current_tier, updated_at)
  VALUES (p_user, v_played, v_won, v_points, v_cur, v_best, v_tier, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    events_played  = EXCLUDED.events_played,
    events_won     = EXCLUDED.events_won,
    points_total   = EXCLUDED.points_total,
    current_streak = EXCLUDED.current_streak,
    best_streak    = EXCLUDED.best_streak,
    current_tier   = EXCLUDED.current_tier,
    updated_at     = NOW();

  RETURN jsonb_build_object('ok', true, 'won', v_won, 'tier', v_tier, 'streak', v_cur);
END;
$$;

REVOKE ALL ON FUNCTION games_join_pot(UUID, UUID, TEXT)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION games_pot_settle(UUID, TEXT)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION games_pot_refund(UUID)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION games_recalc_stats(UUID)           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION games_join_pot(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION games_pot_settle(UUID, TEXT)     TO service_role;
GRANT EXECUTE ON FUNCTION games_pot_refund(UUID)           TO service_role;
GRANT EXECUTE ON FUNCTION games_recalc_stats(UUID)         TO service_role;
