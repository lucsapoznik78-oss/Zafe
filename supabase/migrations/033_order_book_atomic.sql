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
