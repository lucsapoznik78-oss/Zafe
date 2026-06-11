-- ============================================================
-- ZAFE — Migration 029: enum values que o código já usa (audit N1 + N3)
-- ============================================================
-- N1 (CRITICAL): lib/order-matching.ts marca a aposta do vendedor como
-- status='exited' quando a posição é vendida por inteiro no mercado
-- secundário, mas o enum bet_status (001) não tinha esse valor — todo trade
-- que consumia a posição inteira estourava constraint e quebrava o matching.
--
-- N3 (HIGH): lib/order-matching.ts insere notificações type='trade_executed';
-- sem o valor no enum, o Promise.allSettled engolia o erro e a notificação
-- nunca era criada.
--
-- Aditiva e idempotente (ADD VALUE IF NOT EXISTS). Os novos valores não são
-- usados nesta mesma transação, então é seguro rodar num único batch.

ALTER TYPE bet_status ADD VALUE IF NOT EXISTS 'exited';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trade_executed';
-- ============================================================
-- ZAFE — Migration 030: RLS nas tabelas sem proteção + constraints ZC$
-- (audit N2 CRITICAL + N5 + N19)
-- ============================================================
-- N2: as tabelas criadas em 005 (concurso) e 021 (comunidade/push/referrals/
-- desafios) nunca habilitaram RLS. As escritas passam pelo service role
-- (que ignora RLS), mas qualquer query com a anon key alcançava saldos ZC$,
-- dados de inscrição e endpoints de push sem restrição.
--
-- Princípios:
--  * Escritas continuam exclusivas do service role (sem policy = negado),
--    EXCETO push_subscriptions e referrals, que o código grava com o client
--    do usuário (app/api/push/*, app/api/referral/registrar).
--  * Leituras: dados públicos (concursos, eventos da comunidade, reputação,
--    snapshots, contestações) liberados; dados por usuário (carteiras ZC$,
--    palpites, inscrições, push, referrals) restritos ao dono.
--  * Verificado: nenhuma página/rota lê essas tabelas com o client do
--    usuário além de perfil (referrals) e push/* — o resto é admin client.
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.

-- ── Concurso ────────────────────────────────────────────────────
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concursos_select_all ON concursos;
CREATE POLICY concursos_select_all ON concursos
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE inscricoes_concurso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inscricoes_select_own ON inscricoes_concurso;
CREATE POLICY inscricoes_select_own ON inscricoes_concurso
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE concurso_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concurso_wallets_select_own ON concurso_wallets;
CREATE POLICY concurso_wallets_select_own ON concurso_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE concurso_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concurso_bets_select_own ON concurso_bets;
CREATE POLICY concurso_bets_select_own ON concurso_bets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Comunidade (conteúdo público; palpites visíveis a logados) ──
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_events_select_all ON community_events;
CREATE POLICY community_events_select_all ON community_events
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE community_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_bets_select_auth ON community_bets;
CREATE POLICY community_bets_select_auth ON community_bets
  FOR SELECT TO authenticated USING (true);

ALTER TABLE community_contestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_contestations_select_auth ON community_contestations;
CREATE POLICY community_contestations_select_auth ON community_contestations
  FOR SELECT TO authenticated USING (true);

ALTER TABLE community_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_snapshots_select_all ON community_snapshots;
CREATE POLICY community_snapshots_select_all ON community_snapshots
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE creator_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_reputation_select_all ON creator_reputation;
CREATE POLICY creator_reputation_select_all ON creator_reputation
  FOR SELECT TO anon, authenticated USING (true);

-- ── Push subscriptions (CRUD do próprio usuário via user client) ─
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_select_own ON push_subscriptions;
CREATE POLICY push_subs_select_own ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_insert_own ON push_subscriptions;
CREATE POLICY push_subs_insert_own ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_update_own ON push_subscriptions;
CREATE POLICY push_subs_update_own ON push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_delete_own ON push_subscriptions;
CREATE POLICY push_subs_delete_own ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Referrals (perfil lê como referrer; registrar insere como referred) ─
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referrals_select_own ON referrals;
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());
DROP POLICY IF EXISTS referrals_insert_as_referred ON referrals;
CREATE POLICY referrals_insert_as_referred ON referrals
  FOR INSERT TO authenticated WITH CHECK (referred_id = auth.uid());

-- ── Desafios ────────────────────────────────────────────────────
ALTER TABLE desafio_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desafio_bets_select_own ON desafio_bets;
CREATE POLICY desafio_bets_select_own ON desafio_bets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── N5: ZC$ nunca negativo (espelha wallets da 001) ─────────────
DO $$ BEGIN
  ALTER TABLE concurso_wallets
    ADD CONSTRAINT concurso_wallets_balance_nonneg CHECK (balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── N19: coluna version + trigger (espelha migration 023) ───────
ALTER TABLE concurso_wallets ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS trg_bump_concurso_wallet_version ON concurso_wallets;
CREATE TRIGGER trg_bump_concurso_wallet_version
  BEFORE UPDATE ON concurso_wallets
  FOR EACH ROW
  EXECUTE FUNCTION bump_wallet_version();
-- ============================================================
-- ZAFE — Migration 031: inscrição atômica no concurso (audit N6 + N7)
-- ============================================================
-- N6: inscrever/reentrar inseriam inscricoes_concurso e concurso_wallets em
-- dois awaits independentes — falha no meio deixava inscrição sem carteira
-- (ou carteira órfã). Agora ambos os INSERTs acontecem numa única transação.
--
-- N7: os INSERTs omitiam saldo_inicial, então a coluna ficava no DEFAULT 1000
-- mesmo quando o concurso tinha outro saldo — quebrando o ROI do ranking.
-- A função grava o saldo_inicial real do concurso nas duas tabelas.
--
-- SECURITY DEFINER service-role-only: mesma exceção consciente documentada
-- nas funções da Zafe Copa (027) — atomicidade multi-tabela que o client TS
-- não garante. A rota continua validando sessão/KYC/18+ antes do RPC.

CREATE OR REPLACE FUNCTION concurso_inscrever(p_user UUID, p_concurso UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC(12,2);
  v_balance NUMERIC(12,2);
BEGIN
  -- Concurso precisa estar ativo e dentro do período (revalida no banco,
  -- fechando o TOCTOU entre a leitura na rota e a inscrição).
  SELECT saldo_inicial INTO v_saldo
  FROM concursos
  WHERE id = p_concurso
    AND status = 'ativo'
    AND periodo_inicio <= NOW()
    AND periodo_fim >= NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_active');
  END IF;

  INSERT INTO inscricoes_concurso (user_id, concurso_id, saldo_inicial)
  VALUES (p_user, p_concurso, v_saldo)
  ON CONFLICT (user_id, concurso_id) DO NOTHING;

  IF NOT FOUND THEN
    -- Já inscrito: devolve o saldo REAL da carteira (audit N18 — antes a
    -- rota devolvia saldo_inicial, mostrando ZC$ errado na UI).
    SELECT balance INTO v_balance
    FROM concurso_wallets
    WHERE user_id = p_user AND concurso_id = p_concurso;

    RETURN jsonb_build_object(
      'status', 'already_enrolled',
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- Carteira ZC$ na mesma transação. ON CONFLICT cobre carteira órfã criada
  -- pelo bug antigo (não zera o saldo existente).
  INSERT INTO concurso_wallets (user_id, concurso_id, balance)
  VALUES (p_user, p_concurso, v_saldo)
  ON CONFLICT (user_id, concurso_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM concurso_wallets
  WHERE user_id = p_user AND concurso_id = p_concurso;

  RETURN jsonb_build_object('status', 'ok', 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION concurso_inscrever(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION concurso_inscrever(UUID, UUID) TO service_role;
-- ============================================================
-- ZAFE — Migration 032: voto de juiz atômico (audit N10)
-- ============================================================
-- O upsert do voto em votar-resultado não re-checava fase/deadline no
-- momento da escrita: um voto correndo contra fecharVotacao podia ser
-- contado depois da apuração, corrompendo a supermaioria de 67%.
--
-- Esta função grava o voto num único UPDATE com todas as condições no
-- WHERE (juiz da rodada, ainda não votou, fase de votação correta, prazo
-- aberto). O re-check de EvalPlanQual do Postgres garante que, se
-- fecharVotacao mudar a fase concorrentemente, o voto NÃO é gravado.
--
-- SECURITY DEFINER service-role-only (rota valida a sessão antes).

CREATE OR REPLACE FUNCTION registrar_voto_juiz(
  p_topic UUID,
  p_judge UUID,
  p_round INTEGER,
  p_vote TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase TEXT := CASE WHEN p_round = 1 THEN 'voting' ELSE 'voting_round2' END;
  v_count INTEGER;
BEGIN
  IF p_vote NOT IN ('sim', 'nao') THEN
    RETURN jsonb_build_object('status', 'invalid_vote');
  END IF;

  UPDATE judge_outcome_votes v
  SET vote = p_vote, voted_at = NOW()
  FROM topics t
  WHERE v.topic_id = p_topic
    AND v.judge_id = p_judge
    AND v.round = p_round
    AND v.voted_at IS NULL
    AND t.id = v.topic_id
    AND t.private_phase = v_phase
    AND t.judge_vote_deadline > NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION registrar_voto_juiz(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_voto_juiz(UUID, UUID, INTEGER, TEXT) TO service_role;
-- ============================================================
-- ZAFE — Migration 033: mercado secundário atômico (audit H3 + H4)
-- ============================================================
-- H3: executeTrade (lib/order-matching.ts) rodava crédito do vendedor,
-- reembolso de escrow, baixa da posição vendida e criação da posição do
-- comprador como awaits independentes — uma falha no meio pagava o vendedor
-- sem criar a posição do comprador, quebrando a conservação de Z$.
-- `execute_trade` faz tudo numa única transação: ou o trade inteiro
-- acontece, ou nada acontece.
--
-- H4: a rota de ordens calculava o "disponível para venda" com uma leitura
-- não-atômica — duas SELLs concorrentes sobre a mesma aposta passavam ambas
-- e a posição era vendida em dobro. `create_sell_order` tranca a aposta
-- (FOR UPDATE) e valida + insere a ordem na mesma transação.
--
-- SECURITY DEFINER service-role-only: mesma exceção consciente à regra
-- "wallet só via lib/wallet.ts" documentada na 027/031 — atomicidade
-- multi-tabela. O trigger trg_bump_wallet_version (023) continua bumpando
-- a version a cada crédito.

-- ── H3: execução atômica de um trade ────────────────────────────
CREATE OR REPLACE FUNCTION execute_trade(
  p_topic UUID,
  p_desafio UUID,
  p_side TEXT,
  p_buy_order UUID,
  p_sell_order UUID,
  p_buyer UUID,
  p_seller UUID,
  p_price NUMERIC,
  p_quantity NUMERIC,
  p_buy_limit NUMERIC,
  p_source_bet UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_value NUMERIC(12,2) := round(p_price * p_quantity, 2);
  v_escrow_excess NUMERIC(12,2) := round((p_buy_limit - p_price) * p_quantity, 2);
  v_entry_odds NUMERIC(8,4) := round(1.0 / p_price, 4);
  v_ref UUID := COALESCE(p_desafio, p_topic);
  v_amount NUMERIC(12,2);
BEGIN
  IF p_side NOT IN ('sim', 'nao') OR p_price <= 0 OR p_price >= 1 OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'parâmetros de trade inválidos';
  END IF;

  -- 1. Registrar o trade
  INSERT INTO trades (topic_id, desafio_id, buy_order_id, sell_order_id,
                      side, price, quantity, buyer_id, seller_id)
  VALUES (p_topic, p_desafio, p_buy_order, p_sell_order,
          p_side, p_price, p_quantity, p_buyer, p_seller);

  -- 2. Creditar o vendedor (UPDATE único = atômico; trigger bumpa version)
  UPDATE wallets SET balance = balance + v_trade_value WHERE user_id = p_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'carteira do vendedor não encontrada';
  END IF;

  INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
  VALUES (p_seller, 'bet_exited', v_trade_value, v_trade_value,
          format('Venda mercado secundário %s · %s¢', upper(p_side), to_char(p_price * 100, 'FM990.0')),
          v_ref);

  -- 3. Devolver excesso de escrow ao comprador (execução ao preço do maker)
  IF v_escrow_excess > 0.01 THEN
    UPDATE wallets SET balance = balance + v_escrow_excess WHERE user_id = p_buyer;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'carteira do comprador não encontrada';
    END IF;

    INSERT INTO transactions (user_id, type, amount, net_amount, description, reference_id)
    VALUES (p_buyer, 'bet_refund', v_escrow_excess, v_escrow_excess,
            format('Reembolso de escrow %s — execução a %s¢', upper(p_side), to_char(p_price * 100, 'FM990.0')),
            v_ref);
  END IF;

  -- 4. Baixar a posição do vendedor (lock da linha contra SELLs concorrentes)
  IF p_source_bet IS NOT NULL THEN
    IF p_desafio IS NULL THEN
      SELECT amount INTO v_amount FROM bets WHERE id = p_source_bet FOR UPDATE;
      IF FOUND THEN
        IF v_amount - p_quantity <= 0.01 THEN
          UPDATE bets SET status = 'exited' WHERE id = p_source_bet;
        ELSE
          UPDATE bets
          SET amount = amount - p_quantity,
              gross_amount = gross_amount - p_quantity
          WHERE id = p_source_bet;
        END IF;
      END IF;
    ELSE
      SELECT amount INTO v_amount FROM desafio_bets WHERE id = p_source_bet FOR UPDATE;
      IF FOUND THEN
        IF v_amount - p_quantity <= 0.01 THEN
          UPDATE desafio_bets SET status = 'exited' WHERE id = p_source_bet;
        ELSE
          UPDATE desafio_bets SET amount = amount - p_quantity WHERE id = p_source_bet;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 5. Criar a posição do comprador
  IF p_desafio IS NULL THEN
    INSERT INTO bets (topic_id, user_id, side, amount, gross_amount, locked_odds,
                      status, matched_amount, unmatched_amount, potential_payout, is_private)
    VALUES (p_topic, p_buyer, p_side::bet_side, p_quantity, p_quantity, v_entry_odds,
            'matched', p_quantity, 0, round(p_quantity * v_entry_odds, 2), false);
  ELSE
    INSERT INTO desafio_bets (desafio_id, user_id, side, amount, locked_odds, status)
    VALUES (p_desafio, p_buyer, p_side::bet_side, p_quantity, v_entry_odds, 'matched');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'trade_value', v_trade_value);
END;
$$;

REVOKE ALL ON FUNCTION execute_trade(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION execute_trade(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;

-- ── H4: criação de ordem SELL com disponibilidade atômica ───────
CREATE OR REPLACE FUNCTION create_sell_order(
  p_topic UUID,
  p_user UUID,
  p_side TEXT,
  p_price NUMERIC,
  p_quantity NUMERIC,
  p_source_bet UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_listed NUMERIC(12,2);
  v_available NUMERIC(12,2);
  v_order_id UUID;
BEGIN
  -- Lock da aposta-fonte: serializa SELLs concorrentes sobre a mesma posição.
  SELECT id, user_id, side, amount, status INTO v_bet
  FROM bets WHERE id = p_source_bet FOR UPDATE;

  IF NOT FOUND OR v_bet.user_id <> p_user THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_bet.side::TEXT <> p_side THEN
    RETURN jsonb_build_object('status', 'side_mismatch');
  END IF;
  IF v_bet.status::TEXT NOT IN ('pending', 'matched', 'partial') THEN
    RETURN jsonb_build_object('status', 'not_active');
  END IF;

  SELECT COALESCE(SUM(quantity - filled_qty), 0) INTO v_listed
  FROM orders
  WHERE source_bet_id = p_source_bet AND status IN ('open', 'partial');

  v_available := v_bet.amount - v_listed;

  IF p_quantity > v_available + 0.01 THEN
    RETURN jsonb_build_object('status', 'insufficient', 'available', GREATEST(v_available, 0));
  END IF;

  INSERT INTO orders (topic_id, user_id, side, order_type, price, quantity,
                      filled_qty, status, source_bet_id)
  VALUES (p_topic, p_user, p_side, 'sell', round(p_price, 4), round(p_quantity, 2),
          0, 'open', p_source_bet)
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object('status', 'ok', 'order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION create_sell_order(UUID, UUID, TEXT, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sell_order(UUID, UUID, TEXT, NUMERIC, NUMERIC, UUID) TO service_role;
-- ============================================================
-- ZAFE — Migration 034: colunas de 2FA em profiles (audit #13)
-- ============================================================
-- O código já lê/escreve two_fa_enabled, two_fa_method e phone
-- (components/auth/LoginForm.tsx, components/perfil/TwoFaSettings.tsx),
-- mas nenhuma migration as criava — ambientes recriados do zero quebram.
-- Em prod as colunas podem já existir (criadas manualmente): IF NOT EXISTS.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_fa_method TEXT CHECK (two_fa_method IN ('email', 'sms')),
  ADD COLUMN IF NOT EXISTS phone TEXT;
-- ============================================================
-- ZAFE — Migration 035: índice cobridor para v_topic_stats (audit #31)
-- ============================================================
-- v_topic_stats é uma view simples agregando bets por topic_id, consultada
-- em toda página + polls de 15/30s + a cada palpite. Todos os consumidores
-- (exceto 2 listas pequenas) filtram por topic_id — o Postgres empurra o
-- predicado para dentro do GROUP BY, então o custo real é a leitura das
-- bets do tópico. Este índice cobridor (INCLUDE side, status, amount)
-- permite index-only scan: a agregação inteira sai do índice, sem heap.
-- Materialização/denormalização fica adiada até a escala exigir (residual).

CREATE INDEX IF NOT EXISTS idx_bets_topic_stats
  ON bets (topic_id) INCLUDE (side, status, amount);
-- ============================================================
-- ZAFE — Migration 036: gestão de usuários no admin (audit #21)
-- ============================================================
-- #21: faltavam três fluxos de admin — banir/suspender, visão de carteira
-- por usuário e ajuste manual de Z$. Esta migration cria a base de dados:
-- a coluna `banned` (enforcement no middleware + rotas /api/admin/usuarios)
-- e o tipo de transação para ajustes manuais auditáveis.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'manual_adjustment';
