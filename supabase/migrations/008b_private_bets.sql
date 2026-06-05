-- ============================================================
-- ZAFE — Sistema de Apostas Privadas em Grupo
-- ============================================================

-- Fase da aposta privada
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS private_phase TEXT
    CHECK (private_phase IN (
      'recruiting','leader_election','judge_negotiation',
      'judge_confirmation','active','voting','voting_round2',
      'resolved','cancelled'
    )),
  ADD COLUMN IF NOT EXISTS recruitment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS leader_election_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS negotiation_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS judge_vote_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_participants INT DEFAULT 5;

-- ── Lados da aposta (A = SIM, B = NAO) ──────────────────────
CREATE TABLE IF NOT EXISTS topic_sides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL CHECK (side IN ('A','B')),
  leader_id UUID REFERENCES profiles(id),
  leader_elected_at TIMESTAMPTZ,
  UNIQUE(topic_id, side)
);

-- ── Participantes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  side CHAR(1) NOT NULL CHECK (side IN ('A','B')),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','accepted','declined','expired')),
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ,
  UNIQUE(topic_id, user_id)
);

-- ── Votos para eleição de líder ──────────────────────────────
CREATE TABLE IF NOT EXISTS leader_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL,
  voter_id UUID NOT NULL REFERENCES profiles(id),
  candidate_id UUID NOT NULL REFERENCES profiles(id),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, side, voter_id)
);

-- ── Nomeações de juízes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS judge_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES profiles(id),
  proposed_by_side CHAR(1) NOT NULL,
  -- aprovações de cada líder (null=pendente, true=aceito, false=rejeitado)
  leader_a_approved BOOLEAN,
  leader_b_approved BOOLEAN,
  -- se este juiz substitui outro rejeitado
  replaces_id UUID REFERENCES judge_nominations(id),
  -- status geral
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','both_approved','active','rejected','declined')),
  -- prazo para o outro lado responder (24h)
  response_deadline TIMESTAMPTZ,
  -- prazo para o juiz confirmar disponibilidade (12h)
  availability_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Votos dos juízes sobre o resultado ──────────────────────
CREATE TABLE IF NOT EXISTS judge_outcome_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES profiles(id),
  vote TEXT CHECK (vote IN ('sim','nao')),
  round INT NOT NULL DEFAULT 1,
  voted_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  UNIQUE(topic_id, judge_id, round)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE topic_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_outcome_votes ENABLE ROW LEVEL SECURITY;

-- topic_sides: participantes do topic podem ver
CREATE POLICY "Participantes veem lados" ON topic_sides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM topic_participants
    WHERE topic_participants.topic_id = topic_sides.topic_id
    AND topic_participants.user_id = auth.uid()
    AND topic_participants.status = 'accepted'
  ));

-- topic_participants: todos os membros e o criador podem ver
CREATE POLICY "Membros veem participantes" ON topic_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM topic_participants tp2
      WHERE tp2.topic_id = topic_participants.topic_id
      AND tp2.user_id = auth.uid()
      AND tp2.status = 'accepted'
    )
  );

-- leader_votes: só o próprio voto
CREATE POLICY "Cada um ve seu voto" ON leader_votes FOR SELECT
  USING (voter_id = auth.uid());

-- judge_nominations: participantes e o próprio juiz podem ver
CREATE POLICY "Membros veem nomeacoes" ON judge_nominations FOR SELECT
  USING (
    judge_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM topic_participants
      WHERE topic_participants.topic_id = judge_nominations.topic_id
      AND topic_participants.user_id = auth.uid()
      AND topic_participants.status = 'accepted'
    )
  );

-- judge_outcome_votes: participantes podem ver (para auditar)
CREATE POLICY "Participantes veem votos resultado" ON judge_outcome_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM topic_participants
    WHERE topic_participants.topic_id = judge_outcome_votes.topic_id
    AND topic_participants.user_id = auth.uid()
    AND topic_participants.status = 'accepted'
  ));

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_topic_participants_topic ON topic_participants(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_user ON topic_participants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_nominations_topic ON judge_nominations(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_outcome_votes_topic ON judge_outcome_votes(topic_id, round);
CREATE INDEX IF NOT EXISTS idx_topics_private_phase
  ON topics(private_phase, recruitment_deadline, negotiation_deadline, judge_vote_deadline)
  WHERE is_private = TRUE;
