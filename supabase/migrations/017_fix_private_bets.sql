-- Fix: permitir side 'J' (juiz) em topic_participants
ALTER TABLE topic_participants
  DROP CONSTRAINT IF EXISTS topic_participants_side_check,
  ADD CONSTRAINT topic_participants_side_check
    CHECK (side IN ('A','B','J'));

-- Fix: adicionar judge_id à tabela topics (se não existir)
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS judge_id UUID REFERENCES profiles(id);

-- Garantir que a tabela topic_sides existe com os lados corretos
INSERT INTO topic_sides (topic_id, side)
  SELECT t.id, s.side
  FROM topics t
  CROSS JOIN (VALUES ('A'), ('B')) AS s(side)
  WHERE t.is_private = TRUE
    AND t.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM topic_sides ts
      WHERE ts.topic_id = t.id AND ts.side = s.side
    );
