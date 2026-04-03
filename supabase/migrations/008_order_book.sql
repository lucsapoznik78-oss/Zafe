-- ══════════════════════════════════════════════════════════════
-- MERCADO SECUNDÁRIO — ORDER BOOK
-- Executa no SQL editor do Supabase Dashboard
-- ══════════════════════════════════════════════════════════════

-- Ordens de compra e venda (limit + market)
CREATE TABLE IF NOT EXISTS orders (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id),
  side         TEXT        NOT NULL CHECK (side IN ('sim', 'nao')),
  order_type   TEXT        NOT NULL CHECK (order_type IN ('buy', 'sell')),
  -- Preço em probabilidade: 0.01 – 0.99 (ex: 0.65 = 65 centavos por Z$1 de face value)
  price        NUMERIC(8,4) NOT NULL CHECK (price > 0 AND price < 1),
  -- Quantidade em Z$ (face value da posição)
  quantity     NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  filled_qty   NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'partial', 'filled', 'cancelled', 'expired')),
  -- Para sell orders: aposta original sendo vendida
  source_bet_id UUID       REFERENCES bets(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trades executados (histórico de preços)
CREATE TABLE IF NOT EXISTS trades (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      UUID        NOT NULL REFERENCES topics(id),
  buy_order_id  UUID        REFERENCES orders(id),
  sell_order_id UUID        REFERENCES orders(id),
  side          TEXT        NOT NULL CHECK (side IN ('sim', 'nao')),
  price         NUMERIC(8,4) NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL,
  buyer_id      UUID        NOT NULL REFERENCES profiles(id),
  seller_id     UUID        NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_orders_topic_side_status
  ON orders(topic_id, side, status, price);
CREATE INDEX IF NOT EXISTS idx_orders_user
  ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_source_bet
  ON orders(source_bet_id) WHERE source_bet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_topic_side_created
  ON trades(topic_id, side, created_at DESC);

-- RLS: usuários veem apenas suas próprias ordens + ordens abertas do livro
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (status IN ('open', 'partial') OR user_id = auth.uid());

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "trades_select" ON trades FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());
