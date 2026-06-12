-- ============================================================
-- ZAFE — Migration 037: palpites de classificação por grupo (Copa)
-- ============================================================
-- O participante escolhe quem termina em 1º, 2º e 3º em cada grupo
-- (A–L). Editável até o início da última rodada do grupo (validado
-- na rota /api/copa/grupos). Quando os 6 jogos do grupo terminam,
-- cada posição exata vale +10 pts no ledger (reason 'group_pick',
-- ancorado no último jogo do grupo — idempotente por UNIQUE).

CREATE TABLE IF NOT EXISTS copa_group_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES copa_competition(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES copa_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL CHECK (group_name ~ '^[A-L]$'),
  first_team TEXT NOT NULL,
  second_team TEXT NOT NULL,
  third_team TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (competition_id, user_id, group_name),
  CHECK (
    first_team <> second_team
    AND first_team <> third_team
    AND second_team <> third_team
  )
);

CREATE INDEX IF NOT EXISTS idx_copa_group_picks_participant
  ON copa_group_picks(participant_id);
CREATE INDEX IF NOT EXISTS idx_copa_group_picks_group
  ON copa_group_picks(competition_id, group_name);

ALTER TABLE copa_group_picks ENABLE ROW LEVEL SECURITY;

-- Anti-cópia: o próprio usuário sempre vê os seus; os dos outros só
-- depois que a última rodada do grupo começou (nenhum jogo futuro).
CREATE POLICY copa_group_picks_select ON copa_group_picks
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM copa_matches m
      WHERE m.competition_id = copa_group_picks.competition_id
        AND m.stage = 'group'
        AND m.group_name = copa_group_picks.group_name
        AND m.kickoff_at > NOW()
    )
  );
-- Escrita só via service role (a rota valida participante + prazo).

-- Pontos de classificação de grupo entram no mesmo ledger
ALTER TABLE copa_score_events DROP CONSTRAINT IF EXISTS copa_score_events_reason_check;
ALTER TABLE copa_score_events ADD CONSTRAINT copa_score_events_reason_check
  CHECK (reason IN ('outcome', 'exact_score', 'group_pick'));
