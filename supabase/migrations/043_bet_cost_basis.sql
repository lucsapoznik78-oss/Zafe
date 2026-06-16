-- ============================================================
-- ZAFE — Migration 043: cost_basis em bets (audit G3/G4)
-- ============================================================
-- Uma posição comprada no mercado secundário fica em `bets` com
-- amount = quantity (face value, ex.: 100 Z$), mas o comprador pagou só
-- price*quantity (ex.: 30 Z$ — que o vendedor já embolsou no trade). Como
-- amount era usado tanto no reembolso (lib/payout.ts refundBets) quanto na
-- ponderação do pool parimutuel:
--   G3: no reembolso o comprador recebia o face (100) → cunhava ~70 Z$ do nada.
--   G4: o pool somava o face → pagava mais Z$ do que foi debitado.
--
-- Correção: gravar cost_basis = o Z$ efetivamente debitado por aquela posição
-- (price*quantity em trades; o stake cheio em palpites primários). O reembolso
-- e o pool passam a usar COALESCE(cost_basis, amount) — palpites primários
-- (cost_basis NULL) caem em amount, que para eles É o custo real.

ALTER TABLE bets ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(12,2);

-- execute_trade (migration 033) reescrita: grava cost_basis = v_trade_value
-- (price*quantity) na posição criada para o comprador. Resto idêntico.
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
  v_bq NUMERIC(12,2); v_bf NUMERIC(12,2);
  v_sq NUMERIC(12,2); v_sf NUMERIC(12,2);
BEGIN
  IF p_side NOT IN ('sim', 'nao') OR p_price <= 0 OR p_price >= 1 OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'parâmetros de trade inválidos';
  END IF;

  -- 0. Booking dos fills das ordens DENTRO da transação do trade (audit G10).
  -- Antes a lib atualizava filled_qty com .update().eq("id") sem CAS, então o
  -- match imediato e a varredura do book podiam gravar fills obsoletos / dar
  -- over-fill. Trava as duas ordens em ordem determinística (evita deadlock) e
  -- valida que ambas têm quantidade não-executada suficiente; senão aborta o
  -- trade inteiro com 'fill_conflict' (a lib só faz `continue`).
  PERFORM 1 FROM orders WHERE id IN (p_buy_order, p_sell_order) ORDER BY id FOR UPDATE;

  SELECT quantity, filled_qty INTO v_bq, v_bf FROM orders WHERE id = p_buy_order;
  IF NOT FOUND OR v_bq - v_bf < p_quantity - 0.01 THEN
    RETURN jsonb_build_object('status', 'fill_conflict');
  END IF;
  SELECT quantity, filled_qty INTO v_sq, v_sf FROM orders WHERE id = p_sell_order;
  IF NOT FOUND OR v_sq - v_sf < p_quantity - 0.01 THEN
    RETURN jsonb_build_object('status', 'fill_conflict');
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

  -- 5. Criar a posição do comprador — cost_basis = o que ele pagou (G3/G4)
  IF p_desafio IS NULL THEN
    INSERT INTO bets (topic_id, user_id, side, amount, gross_amount, cost_basis, locked_odds,
                      status, matched_amount, unmatched_amount, potential_payout, is_private)
    VALUES (p_topic, p_buyer, p_side::bet_side, p_quantity, p_quantity, v_trade_value, v_entry_odds,
            'matched', p_quantity, 0, round(p_quantity * v_entry_odds, 2), false);
  ELSE
    INSERT INTO desafio_bets (desafio_id, user_id, side, amount, locked_odds, status)
    VALUES (p_desafio, p_buyer, p_side::bet_side, p_quantity, v_entry_odds, 'matched');
  END IF;

  -- 6. Atualizar os fills das duas ordens (atômico com o trade — audit G10).
  UPDATE orders
  SET filled_qty = round(v_bf + p_quantity, 2),
      status = CASE WHEN v_bf + p_quantity >= quantity - 0.01 THEN 'filled' ELSE 'partial' END
  WHERE id = p_buy_order;

  UPDATE orders
  SET filled_qty = round(v_sf + p_quantity, 2),
      status = CASE WHEN v_sf + p_quantity >= quantity - 0.01 THEN 'filled' ELSE 'partial' END
  WHERE id = p_sell_order;

  RETURN jsonb_build_object('status', 'ok', 'trade_value', v_trade_value);
END;
$$;

REVOKE ALL ON FUNCTION execute_trade(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION execute_trade(UUID, UUID, TEXT, UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;
