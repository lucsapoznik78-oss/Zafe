-- ============================================================
-- ZAFE — Migration 010: Concurso Topics Isolation
-- ============================================================
-- PROBLEMA: O concurso usa os mesmos topics da Liga.
-- "Brasileirão Vencedor" aparece nos dois com o mesmo ID.
-- Apostas na Liga → `bets`, Apostas no Concurso → `concurso_bets`
-- mas o evento é o mesmo. Stats misturadas.
--
-- SOLUÇÃO: Adicionar `concurso_id` aos topics para que cada
-- concurso tenha seus próprios topics independentes.
-- O mesmo título pode existir em ambos, mas como registros separados.

-- 1. Adicionar coluna concurso_id nos topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS concurso_id UUID;

-- 2. Índice para filtrar topics por concurso
CREATE INDEX IF NOT EXISTS idx_topics_concurso_id ON topics(concurso_id);

-- 3. Índice para topics da Liga (sem concurso)
CREATE INDEX IF NOT EXISTS idx_topics_liga_only ON topics(id) WHERE concurso_id IS NULL;

-- 4. Tabela de snapshots para concurso (separada de topic_snapshots)
CREATE TABLE IF NOT EXISTS concurso_topic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL,
  concurso_id UUID NOT NULL,
  prob_sim NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  volume_sim NUMERIC(12,2) DEFAULT 0,
  volume_nao NUMERIC(12,2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concurso_snapshots_topic_concurso
  ON concurso_topic_snapshots(topic_id, concurso_id, recorded_at);

-- 5. View de stats para concurso (baseada apenas em concurso_bets)
DROP VIEW IF EXISTS v_concurso_topic_stats;
CREATE VIEW v_concurso_topic_stats AS
SELECT 
  cb.topic_id,
  cb.concurso_id,
  COALESCE(SUM(CASE WHEN cb.side = 'sim' THEN cb.amount ELSE 0 END), 0) AS volume_sim,
  COALESCE(SUM(CASE WHEN cb.side = 'nao' THEN cb.amount ELSE 0 END), 0) AS volume_nao,
  COALESCE(SUM(cb.amount), 0) AS total_volume,
  CASE 
    WHEN COALESCE(SUM(cb.amount), 0) = 0 THEN 0.5
    ELSE COALESCE(SUM(CASE WHEN cb.side = 'sim' THEN cb.amount ELSE 0 END), 0)
         / NULLIF(SUM(cb.amount), 0)
  END AS prob_sim,
  CASE 
    WHEN COALESCE(SUM(cb.amount), 0) = 0 THEN 0.5
    ELSE COALESCE(SUM(CASE WHEN cb.side = 'nao' THEN cb.amount ELSE 0 END), 0)
         / NULLIF(SUM(cb.amount), 0)
  END AS prob_nao,
  COUNT(DISTINCT cb.id) AS bet_count
FROM concurso_bets cb
WHERE cb.status NOT IN ('refunded', 'cancelled')
GROUP BY cb.topic_id, cb.concurso_id;

-- 6. View de ranking do concurso
DROP VIEW IF EXISTS v_concurso_ranking;
CREATE VIEW v_concurso_ranking AS
SELECT
  i.user_id,
  i.concurso_id,
  p.username,
  p.full_name,
  p.avatar_url,
  w.balance AS saldo_atual,
  i.saldo_inicial,
  (w.balance - i.saldo_inicial) AS lucro,
  CASE WHEN i.saldo_inicial > 0 THEN ROUND(((w.balance - i.saldo_inicial)::NUMERIC / i.saldo_inicial) * 100, 2) ELSE 0 END AS roi_pct,
  COALESCE(COUNT(cb.id) FILTER (WHERE cb.status IN ('won', 'lost')), 0) AS total_apostas,
  COALESCE(COUNT(cb.id) FILTER (WHERE cb.status = 'won'), 0) AS apostas_ganhas,
  CASE 
    WHEN COALESCE(COUNT(cb.id) FILTER (WHERE cb.status IN ('won', 'lost')), 0) = 0 THEN 0
    ELSE ROUND(
      (COUNT(cb.id) FILTER (WHERE cb.status = 'won')::NUMERIC / 
       NULLIF(COUNT(cb.id) FILTER (WHERE cb.status IN ('won', 'lost')), 0)) * 100, 1)
  END AS win_rate,
  ROW_NUMBER() OVER (PARTITION BY i.concurso_id ORDER BY w.balance DESC) AS posicao
FROM inscricoes_concurso i
JOIN concurso_wallets w ON w.user_id = i.user_id AND w.concurso_id = i.concurso_id
LEFT JOIN profiles p ON p.id = i.user_id
LEFT JOIN concurso_bets cb ON cb.user_id = i.user_id AND cb.concurso_id = i.concurso_id
GROUP BY i.user_id, i.concurso_id, p.username, p.full_name, p.avatar_url, w.balance, i.saldo_inicial;

-- 7. RLS policies para concurso_topic_snapshots
ALTER TABLE concurso_topic_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "concurso_topic_snapshots_insert_admin"
  ON concurso_topic_snapshots FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "concurso_topic_snapshots_read_public"
  ON concurso_topic_snapshots FOR SELECT TO authenticated
  USING (true);

-- 8. Constraints de integridade
ALTER TABLE topics
  ADD CONSTRAINT fk_topics_concurso
  FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE SET NULL;

ALTER TABLE concurso_topic_snapshots
  ADD CONSTRAINT fk_concurso_snapshots_topic
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_concurso_snapshots_concurso
  FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE CASCADE;

