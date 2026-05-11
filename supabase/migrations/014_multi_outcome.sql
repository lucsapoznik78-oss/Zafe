-- Migração 014: Mercados Multi-Resultado
-- Adiciona suporte a mercados com N resultados possíveis (ex: "Quem vai ser campeão?")

-- 1. Tipo de mercado e vencedor em topics
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'binary',
  ADD COLUMN IF NOT EXISTS winning_outcome_id UUID;

-- 2. Tabela de resultados possíveis
CREATE TABLE IF NOT EXISTS topic_outcomes (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID    NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  position   INT     NOT NULL DEFAULT 0,
  pool       NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_outcomes_topic_id ON topic_outcomes(topic_id);

-- FK winning_outcome_id → topic_outcomes (após criar a tabela)
DO $$ BEGIN
  ALTER TABLE topics
    ADD CONSTRAINT fk_topics_winning_outcome
    FOREIGN KEY (winning_outcome_id) REFERENCES topic_outcomes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. outcome_id em bets (nulo para apostas binárias)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS outcome_id UUID REFERENCES topic_outcomes(id);
DO $$ BEGIN
  ALTER TABLE bets ALTER COLUMN side DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. concurso_bets também suporta multi
ALTER TABLE concurso_bets ADD COLUMN IF NOT EXISTS outcome_id UUID REFERENCES topic_outcomes(id);
DO $$ BEGIN
  ALTER TABLE concurso_bets ALTER COLUMN side DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 5. RLS topic_outcomes
ALTER TABLE topic_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "outcomes_public_read" ON topic_outcomes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "outcomes_service_write" ON topic_outcomes FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
