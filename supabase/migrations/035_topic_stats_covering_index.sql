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
