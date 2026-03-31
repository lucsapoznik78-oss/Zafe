-- ============================================================
-- ZAFE — Oracle System
-- ============================================================

-- Adiciona status 'resolving' ao enum
ALTER TYPE topic_status ADD VALUE IF NOT EXISTS 'resolving';

-- Colunas oracle nos topics
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS oracle_api_id TEXT,
  ADD COLUMN IF NOT EXISTS oracle_retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oracle_next_retry_at TIMESTAMPTZ;

-- Tabela de auditoria de resoluções
CREATE TABLE IF NOT EXISTS resolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercado_id UUID REFERENCES topics(id) ON DELETE CASCADE,

  -- Camada utilizada
  resolvido_por TEXT, -- 'api_fixa' | 'oracle_ai' | 'reembolso' | 'pendente'
  oracle_usado TEXT,  -- ex: 'api-futebol.com.br' | 'claude-ai'
  numero_tentativa INT,

  -- Resultados do AI triple-check (quando usado)
  check1_resultado TEXT,
  check1_fonte TEXT,
  check1_confianca INT,
  check2_resultado TEXT,
  check2_fonte TEXT,
  check2_confianca INT,
  check3_resultado TEXT,
  check3_fonte TEXT,
  check3_confianca INT,

  -- Decisão final
  resultado_final TEXT, -- 'SIM' | 'NAO' | 'REEMBOLSO' | 'INCERTO'

  resolvido_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para resolucoes (só admin lê/escreve via service role)
ALTER TABLE resolucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver resolucoes"
  ON resolucoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Index para buscar resolucoes por mercado
CREATE INDEX IF NOT EXISTS idx_resolucoes_mercado ON resolucoes(mercado_id);

-- Index para cron: encontrar topics resolving prontos para retry
CREATE INDEX IF NOT EXISTS idx_topics_resolving
  ON topics(status, oracle_next_retry_at)
  WHERE status = 'resolving';
