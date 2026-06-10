-- ============================================================
-- ZAFE — Migration 027: Zafe Copa (Copa do Mundo 2026)
-- ============================================================
-- Módulo isolado de bolão da Copa 2026. Economia própria:
--   * Buy-in de Z$ 400 debitado da carteira PRINCIPAL → forma o pote
--     (pot_total = buy_in × nº participantes). O 1º do ranking final
--     leva o pote inteiro de volta pra carteira principal.
--   * Acertos valem PONTOS internos (copa_score_events), não Z$ —
--     pontos nunca entram na economia Z$ (sem inflação).
--   * Conservação: SUM(wallets.balance) + pot_total = constante.
--
-- NOTA sobre a regra "wallet só via lib/wallet.ts": copa_buy_in e
-- copa_payout mutam wallets direto em SQL porque precisam de
-- atomicidade multi-tabela (wallet + participante + pote + transactions)
-- que o CAS em TypeScript não garante. O UPDATE condicional
-- (balance >= buy_in) é garantia mais forte que o CAS, e o trigger
-- trg_bump_wallet_version (migration 023) continua incrementando a
-- version. Funções SECURITY DEFINER, executáveis APENAS pelo
-- service_role (nunca expostas a anon/authenticated).
--
-- Regras de pontuação (engine determinística em lib/copa/scoring.ts —
-- o oráculo Claude só adjudica o RESULTADO, nunca os pontos):
--   * +10 vencedor/classificado certo, +10 placar exato, máx +20/jogo.
--   * Grupos: palpite 1X2 (home/draw/away); placar = 90 min.
--   * Mata-mata: palpites DESACOPLADOS — classificado (inclui pênaltis)
--     e placar exato julgado pelo placar ao fim da prorrogação quando
--     houver, SEM pênaltis. Placar certo + classificado errado = só +10.
--   * Idempotência: UNIQUE(match_id, participant_id, reason).

-- ------------------------------------------------------------
-- 1. Enum de transactions (só declarados aqui; primeiro USO é em
--    runtime via funções — seguro num único run do SQL editor)
-- ------------------------------------------------------------
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'copa_buy_in';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'copa_prize';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'copa_refund';

-- ------------------------------------------------------------
-- 2. Tabelas
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS copa_competition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  buy_in NUMERIC(12,2) NOT NULL DEFAULT 400 CHECK (buy_in > 0),
  pot_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pot_total >= 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','running','finished','paid','cancelled')),
  winner_user_id UUID REFERENCES profiles(id),
  pot_paid_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copa_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES copa_competition(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- ordem de entrada determinística (timestamps podem colidir):
  -- último critério de desempate do ranking
  join_seq BIGINT GENERATED ALWAYS AS IDENTITY,
  buy_in_paid NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS copa_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES copa_competition(id) ON DELETE CASCADE,
  match_number INTEGER NOT NULL UNIQUE,           -- nº oficial FIFA (1–104)
  stage TEXT NOT NULL CHECK (stage IN ('group','r32','r16','qf','sf','third','final')),
  group_name TEXT,                                -- A–L (só fase de grupos)
  -- NULL até o slot de mata-mata ser preenchido pelo admin
  home_team TEXT,
  away_team TEXT,
  home_placeholder TEXT,                          -- ex.: '1A', '2B', 'V73'
  away_placeholder TEXT,
  -- UTC. Adiamento = admin atualiza kickoff_at e o lock move junto.
  kickoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','postponed','under_review','finished','void')),
  -- Resultado. Semântica do placar: fim do jogo INCLUINDO prorrogação,
  -- EXCLUINDO disputa de pênaltis.
  home_goals INTEGER CHECK (home_goals BETWEEN 0 AND 20),
  away_goals INTEGER CHECK (away_goals BETWEEN 0 AND 20),
  went_to_et BOOLEAN,
  went_to_pens BOOLEAN,
  advanced_side TEXT CHECK (advanced_side IN ('home','away')), -- classificado (inclui pênaltis)
  resolved_at TIMESTAMPTZ,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copa_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES copa_competition(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES copa_matches(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES copa_participants(id) ON DELETE CASCADE,
  -- denormalizado para RLS sem join
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- fase de grupos: 1X2
  outcome_pick TEXT CHECK (outcome_pick IN ('home','draw','away')),
  -- mata-mata: quem se classifica (inclui pênaltis)
  qualifier_pick TEXT CHECK (qualifier_pick IN ('home','away')),
  -- placar exato (empate é palpite válido também no mata-mata: placar
  -- ao fim da prorrogação pode ser empate, decidido nos pênaltis)
  pred_home_goals INTEGER CHECK (pred_home_goals BETWEEN 0 AND 20),
  pred_away_goals INTEGER CHECK (pred_away_goals BETWEEN 0 AND 20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

-- Ledger de pontos. Fonte de verdade do ranking: SUM(points).
-- UNIQUE(match_id, participant_id, reason) = idempotência estrutural
-- (re-resolver uma partida nunca paga 2x).
CREATE TABLE IF NOT EXISTS copa_score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES copa_competition(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES copa_matches(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES copa_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('outcome','exact_score')),
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, participant_id, reason)
);

-- Auditoria do oráculo: toda chamada à API fica registrada (crua).
CREATE TABLE IF NOT EXISTS copa_resolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES copa_matches(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  model TEXT,
  raw_response TEXT NOT NULL,
  parsed JSONB,
  confidence NUMERIC,
  source_url TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN
    ('applied','not_final','manual_review','disagreement','parse_error','api_error','reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copa_matches_resolver ON copa_matches(status, kickoff_at);
CREATE INDEX IF NOT EXISTS idx_copa_predictions_match ON copa_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_copa_predictions_user ON copa_predictions(user_id, competition_id);
CREATE INDEX IF NOT EXISTS idx_copa_score_events_participant ON copa_score_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_copa_resolution_log_match ON copa_resolution_log(match_id);

-- ------------------------------------------------------------
-- 3. Leaderboard (view). Desempate: pontos > placares exatos >
--    vencedores certos > ordem de entrada (join_seq) → 1º sempre único.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_copa_leaderboard
WITH (security_invoker = on) AS
SELECT
  p.competition_id,
  p.id AS participant_id,
  p.user_id,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  p.join_seq,
  COALESCE(SUM(e.points), 0)::INTEGER AS points,
  COUNT(*) FILTER (WHERE e.reason = 'exact_score')::INTEGER AS exact_count,
  COUNT(*) FILTER (WHERE e.reason = 'outcome')::INTEGER AS outcome_count,
  ROW_NUMBER() OVER (
    PARTITION BY p.competition_id
    ORDER BY
      COALESCE(SUM(e.points), 0) DESC,
      COUNT(*) FILTER (WHERE e.reason = 'exact_score') DESC,
      COUNT(*) FILTER (WHERE e.reason = 'outcome') DESC,
      p.join_seq ASC
  )::INTEGER AS posicao
FROM copa_participants p
JOIN profiles pr ON pr.id = p.user_id
LEFT JOIN copa_score_events e ON e.participant_id = p.id
GROUP BY p.competition_id, p.id, p.user_id, pr.username, pr.full_name, pr.avatar_url, p.join_seq;

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE copa_competition    ENABLE ROW LEVEL SECURITY;
ALTER TABLE copa_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE copa_matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE copa_predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE copa_score_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE copa_resolution_log ENABLE ROW LEVEL SECURITY;

-- Leitura pública (autenticados); escrita só via service role
-- (rotas validam auth.getUser() e usam createAdminClient()).
CREATE POLICY copa_competition_select ON copa_competition
  FOR SELECT TO authenticated USING (true);
CREATE POLICY copa_participants_select ON copa_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY copa_matches_select ON copa_matches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY copa_score_events_select ON copa_score_events
  FOR SELECT TO authenticated USING (true);

-- Anti-cópia de palpite: o próprio usuário vê os seus; os dos OUTROS
-- só ficam visíveis depois do kickoff.
CREATE POLICY copa_predictions_select ON copa_predictions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM copa_matches m
      WHERE m.id = copa_predictions.match_id AND m.kickoff_at <= NOW()
    )
  );

-- Defesa em profundidade (escrita real é via service role, que ignora RLS):
CREATE POLICY copa_predictions_insert ON copa_predictions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM copa_matches m
      WHERE m.id = copa_predictions.match_id
        AND m.kickoff_at > NOW()
        AND m.status IN ('scheduled','postponed')
    )
  );
CREATE POLICY copa_predictions_update ON copa_predictions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM copa_matches m
      WHERE m.id = copa_predictions.match_id
        AND m.kickoff_at > NOW()
        AND m.status IN ('scheduled','postponed')
    )
  );

-- copa_resolution_log: nenhuma policy → invisível a authenticated;
-- admin lê via service role.

-- ------------------------------------------------------------
-- 5. Funções (SECURITY DEFINER, service_role only)
-- ------------------------------------------------------------

-- 5.1 Inscrição com buy-in atômico: debita Z$ 400 da carteira principal,
-- cria participante, soma ao pote e registra a transaction — tudo ou nada.
CREATE OR REPLACE FUNCTION copa_buy_in(p_user UUID, p_competition UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp copa_competition%ROWTYPE;
  v_rows INTEGER;
BEGIN
  SELECT * INTO v_comp FROM copa_competition
   WHERE id = p_competition FOR UPDATE;

  IF NOT FOUND OR v_comp.status NOT IN ('open','running') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  -- Débito condicional: mais forte que o CAS (lock de linha + guarda de saldo).
  UPDATE wallets SET balance = balance - v_comp.buy_in
   WHERE user_id = p_user AND balance >= v_comp.buy_in;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient');
  END IF;

  BEGIN
    INSERT INTO copa_participants (competition_id, user_id, buy_in_paid)
    VALUES (p_competition, p_user, v_comp.buy_in);
  EXCEPTION WHEN unique_violation THEN
    -- já inscrito: aborta a função inteira (débito acima é revertido junto)
    RAISE EXCEPTION 'already_joined' USING ERRCODE = 'P0001';
  END;

  UPDATE copa_competition SET pot_total = pot_total + v_comp.buy_in
   WHERE id = p_competition;

  INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
  VALUES (p_user, 'copa_buy_in', -v_comp.buy_in, -v_comp.buy_in,
          'Inscrição ' || v_comp.name, p_competition);

  RETURN jsonb_build_object('ok', true, 'buy_in', v_comp.buy_in);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'already_joined' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_joined');
  END IF;
  RAISE;
END;
$$;

-- 5.2 Pagamento do pote ao 1º do ranking. Guarda CAS
-- (status='finished' AND pot_paid_at IS NULL) → idempotente:
-- double-click/retry nunca paga 2x.
CREATE OR REPLACE FUNCTION copa_payout(p_competition UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner UUID;
  v_pot NUMERIC(12,2);
  v_name TEXT;
  v_rows INTEGER;
BEGIN
  PERFORM 1 FROM copa_competition WHERE id = p_competition FOR UPDATE;

  SELECT user_id INTO v_winner
    FROM v_copa_leaderboard
   WHERE competition_id = p_competition AND posicao = 1;
  IF v_winner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_participants');
  END IF;

  UPDATE copa_competition
     SET status = 'paid', pot_paid_at = NOW(), winner_user_id = v_winner
   WHERE id = p_competition AND status = 'finished' AND pot_paid_at IS NULL
   RETURNING pot_total, name INTO v_pot, v_name;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid_or_not_finished');
  END IF;

  UPDATE wallets SET balance = balance + v_pot WHERE user_id = v_winner;

  INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
  VALUES (v_winner, 'copa_prize', v_pot, v_pot,
          'Premiação ' || v_name, p_competition);

  RETURN jsonb_build_object('ok', true, 'winner_user_id', v_winner, 'pot_total', v_pot);
END;
$$;

-- 5.3 (Re)pontuação atômica de uma partida: apaga os eventos da partida
-- e insere o conjunto recomputado. Usada na 1ª resolução (delete de 0
-- linhas = no-op), em correções e em anulações (p_events = '[]').
-- ON CONFLICT DO NOTHING + UNIQUE = nunca duplica.
CREATE OR REPLACE FUNCTION copa_rescore_match(p_match UUID, p_events JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  DELETE FROM copa_score_events WHERE match_id = p_match;

  INSERT INTO copa_score_events (competition_id, match_id, participant_id, user_id, reason, points)
  SELECT (e->>'competition_id')::UUID,
         p_match,
         (e->>'participant_id')::UUID,
         (e->>'user_id')::UUID,
         e->>'reason',
         COALESCE((e->>'points')::INTEGER, 10)
    FROM jsonb_array_elements(COALESCE(p_events, '[]'::JSONB)) AS e
  ON CONFLICT (match_id, participant_id, reason) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- 5.4 Cancelamento: devolve o buy-in a todos os participantes e zera o
-- pote. Só com a competição 'cancelled' (admin seta antes).
CREATE OR REPLACE FUNCTION copa_refund_all(p_competition UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comp copa_competition%ROWTYPE;
  v_count INTEGER := 0;
  v_part RECORD;
BEGIN
  SELECT * INTO v_comp FROM copa_competition
   WHERE id = p_competition FOR UPDATE;

  IF NOT FOUND OR v_comp.status <> 'cancelled' OR v_comp.pot_paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_cancelled_or_already_paid');
  END IF;

  FOR v_part IN
    SELECT user_id, buy_in_paid FROM copa_participants
     WHERE competition_id = p_competition
  LOOP
    UPDATE wallets SET balance = balance + v_part.buy_in_paid
     WHERE user_id = v_part.user_id;
    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (v_part.user_id, 'copa_refund', v_part.buy_in_paid, v_part.buy_in_paid,
            'Reembolso ' || v_comp.name, p_competition);
    v_count := v_count + 1;
  END LOOP;

  UPDATE copa_competition SET pot_total = 0, pot_paid_at = NOW()
   WHERE id = p_competition;

  RETURN jsonb_build_object('ok', true, 'refunded', v_count);
END;
$$;

-- Funções NUNCA expostas a clientes: só o service role executa.
REVOKE ALL ON FUNCTION copa_buy_in(UUID, UUID)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION copa_payout(UUID)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION copa_rescore_match(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION copa_refund_all(UUID)          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION copa_buy_in(UUID, UUID)        TO service_role;
GRANT EXECUTE ON FUNCTION copa_payout(UUID)              TO service_role;
GRANT EXECUTE ON FUNCTION copa_rescore_match(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION copa_refund_all(UUID)          TO service_role;

-- ------------------------------------------------------------
-- 6. Competição 2026
-- ------------------------------------------------------------
INSERT INTO copa_competition (slug, name, buy_in, status, starts_at, ends_at)
VALUES ('copa-2026', 'Zafe Copa 2026', 400, 'open',
        '2026-06-11T00:00:00Z', '2026-07-19T23:59:59Z')
ON CONFLICT (slug) DO NOTHING;
