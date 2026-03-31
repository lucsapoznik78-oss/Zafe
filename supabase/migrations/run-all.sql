-- ============================================================
-- ZAFE — Migrations 007 + 008
-- Cole este arquivo inteiro no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/mhckuhqyyfoapzgrqeco/sql/new
-- ============================================================


-- ============================================================
-- 007 — Sistema Oracle
-- ============================================================

ALTER TYPE topic_status ADD VALUE IF NOT EXISTS 'resolving';

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS oracle_api_id TEXT,
  ADD COLUMN IF NOT EXISTS oracle_retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oracle_next_retry_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS resolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercado_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  resolvido_por TEXT,
  oracle_usado TEXT,
  numero_tentativa INT,
  check1_resultado TEXT,
  check1_fonte TEXT,
  check1_confianca INT,
  check2_resultado TEXT,
  check2_fonte TEXT,
  check2_confianca INT,
  check3_resultado TEXT,
  check3_fonte TEXT,
  check3_confianca INT,
  resultado_final TEXT,
  resolvido_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resolucoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'resolucoes' AND policyname = 'Admin pode ver resolucoes'
  ) THEN
    CREATE POLICY "Admin pode ver resolucoes" ON resolucoes FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resolucoes_mercado ON resolucoes(mercado_id);
CREATE INDEX IF NOT EXISTS idx_topics_resolving ON topics(status, oracle_next_retry_at);


-- ============================================================
-- 008 — Sistema de Apostas Privadas em Grupo
-- ============================================================

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

CREATE TABLE IF NOT EXISTS topic_sides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL CHECK (side IN ('A','B')),
  leader_id UUID REFERENCES profiles(id),
  leader_elected_at TIMESTAMPTZ,
  UNIQUE(topic_id, side)
);

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

CREATE TABLE IF NOT EXISTS leader_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side CHAR(1) NOT NULL,
  voter_id UUID NOT NULL REFERENCES profiles(id),
  candidate_id UUID NOT NULL REFERENCES profiles(id),
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, side, voter_id)
);

CREATE TABLE IF NOT EXISTS judge_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  judge_user_id UUID NOT NULL REFERENCES profiles(id),
  proposed_by_side CHAR(1) NOT NULL,
  leader_a_approved BOOLEAN,
  leader_b_approved BOOLEAN,
  replaces_id UUID REFERENCES judge_nominations(id),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','both_approved','active','rejected','declined')),
  response_deadline TIMESTAMPTZ,
  availability_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- RLS
ALTER TABLE topic_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_outcome_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'topic_sides' AND policyname = 'Participantes veem lados') THEN
    CREATE POLICY "Participantes veem lados" ON topic_sides FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM topic_participants
        WHERE topic_participants.topic_id = topic_sides.topic_id
        AND topic_participants.user_id = auth.uid()
        AND topic_participants.status = 'accepted'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'topic_participants' AND policyname = 'Membros veem participantes') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leader_votes' AND policyname = 'Cada um ve seu voto') THEN
    CREATE POLICY "Cada um ve seu voto" ON leader_votes FOR SELECT
      USING (voter_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'judge_nominations' AND policyname = 'Membros veem nomeacoes') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'judge_outcome_votes' AND policyname = 'Participantes veem votos resultado') THEN
    CREATE POLICY "Participantes veem votos resultado" ON judge_outcome_votes FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM topic_participants
        WHERE topic_participants.topic_id = judge_outcome_votes.topic_id
        AND topic_participants.user_id = auth.uid()
        AND topic_participants.status = 'accepted'
      ));
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_topic_participants_topic ON topic_participants(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_user ON topic_participants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_nominations_topic ON judge_nominations(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_outcome_votes_topic ON judge_outcome_votes(topic_id, round);
CREATE INDEX IF NOT EXISTS idx_topics_private_phase
  ON topics(private_phase, recruitment_deadline, negotiation_deadline, judge_vote_deadline)
  WHERE is_private = TRUE;
