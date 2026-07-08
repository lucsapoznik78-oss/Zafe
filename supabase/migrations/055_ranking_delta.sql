-- 055: Notificações de movimento no ranking
-- Snapshot diário da posição de cada previsor no ranking geral,
-- usado pelo cron /api/cron/ranking-delta para notificar quem subiu.
-- Aplicar manualmente no SQL editor do Supabase.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ranking_up';

CREATE TABLE IF NOT EXISTS ranking_positions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ranking_positions ENABLE ROW LEVEL SECURITY;

-- Leitura da própria posição; escrita só via service role (cron)
DROP POLICY IF EXISTS "ranking_positions_select_own" ON ranking_positions;
CREATE POLICY "ranking_positions_select_own" ON ranking_positions
  FOR SELECT USING (auth.uid() = user_id);
