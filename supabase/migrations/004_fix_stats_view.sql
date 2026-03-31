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
