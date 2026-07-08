-- 054: Bônus diário com sequência (streak)
-- Resgates diários de Z$ que crescem com dias consecutivos.
-- Aplicar manualmente no SQL editor do Supabase.

-- Novo tipo de transação (fora de transação implícita, como nas migrations 015/020/023)
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'daily_bonus';

CREATE TABLE IF NOT EXISTS daily_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Dia no fuso America/Sao_Paulo, calculado pela API
  claimed_on DATE NOT NULL,
  -- Dias consecutivos até este resgate (>= 1)
  streak INT NOT NULL DEFAULT 1 CHECK (streak >= 1),
  -- Z$ efetivamente creditado (pode ser 0 se a carteira estava no teto;
  -- o resgate ainda conta para manter a sequência)
  bonus NUMERIC(12,2) NOT NULL CHECK (bonus >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Garante 1 resgate por dia por usuário (proteção contra corrida na API)
  UNIQUE (user_id, claimed_on)
);

CREATE INDEX IF NOT EXISTS idx_daily_claims_user_day
  ON daily_claims (user_id, claimed_on DESC);

ALTER TABLE daily_claims ENABLE ROW LEVEL SECURITY;

-- Leitura apenas do próprio histórico; escrita só via service role (API)
DROP POLICY IF EXISTS "daily_claims_select_own" ON daily_claims;
CREATE POLICY "daily_claims_select_own" ON daily_claims
  FOR SELECT USING (auth.uid() = user_id);
