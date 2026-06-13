-- 038: Performance — snapshots, FKs sem índice e índices duplicados
-- Contexto: queries de topic_snapshots nas listagens (/liga, /economico, /concurso)
-- estavam com média de 150-250ms e máx. de 5,9s (statement timeouts = páginas 500).

-- Índice composto para buscar snapshots por tópico ordenados por data
CREATE INDEX IF NOT EXISTS idx_topic_snapshots_topic_recorded
  ON topic_snapshots (topic_id, recorded_at DESC);

-- View com apenas o snapshot mais recente de cada tópico (cards das listagens).
-- security_invoker: respeita o RLS do chamador (snapshots têm leitura pública).
CREATE OR REPLACE VIEW v_latest_topic_snapshots
  WITH (security_invoker = true) AS
  SELECT DISTINCT ON (topic_id) topic_id, prob_sim, recorded_at
  FROM topic_snapshots
  ORDER BY topic_id, recorded_at DESC;

GRANT SELECT ON v_latest_topic_snapshots TO anon, authenticated, service_role;

-- FKs sem índice em tabelas quentes (advisor: unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_bets_outcome_id ON bets (outcome_id) WHERE outcome_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_buy_order_id ON trades (buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order_id ON trades (sell_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON trades (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON trades (seller_id);

-- Índices duplicados idênticos (advisor: duplicate_index) — mantém um de cada
DROP INDEX IF EXISTS idx_community_bets_event_id;     -- mantém idx_community_bets_event
DROP INDEX IF EXISTS idx_concurso_bets_user;          -- mantém idx_concurso_bets_user_concurso
DROP INDEX IF EXISTS idx_concurso_wallets_lookup;     -- mantém idx_concurso_wallets_user_concurso
DROP INDEX IF EXISTS idx_inscricoes_concurso;         -- mantém idx_inscricoes_concurso_concurso
