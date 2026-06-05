-- ============================================================
-- ZAFE — Migration 005: Concurso core tables (reproducibility fix)
-- ============================================================
-- Corrige o audit C8 / #4: as tabelas do Concurso Mensal nunca foram
-- criadas por nenhuma migration numerada — só existiam no banco de produção
-- (provisionado por scripts avulsos). Resultado: num banco LIMPO a migration
-- 010 falhava ao criar a FK `topics.concurso_id -> concursos(id)` (e as views
-- v_concurso_*), porque `concursos`, `concurso_wallets`, `inscricoes_concurso`
-- e `concurso_bets` não existiam ainda.
--
-- Esta migration precisa rodar ANTES da 010. Todas as tabelas usam
-- CREATE TABLE IF NOT EXISTS, então é um no-op idempotente em produção
-- (onde as tabelas já existem) e torna o schema reproduzível do zero.
--
-- Dependências: apenas `profiles` e `topics` (migration 001) + enums
-- `bet_side`/`bet_status` (001). Não referencia `topic_outcomes` (014), por
-- isso `outcome_id` fica como UUID sem FK.

-- Concurso Mensal: um concurso ativo por período, com prêmio em R$ (top 5%).
CREATE TABLE IF NOT EXISTS concursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',        -- ativo | apurando | encerrado
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 1000,
  premios JSONB DEFAULT '[]',                  -- [{ posicao|min|max, valor }]
  periodo_inicio TIMESTAMPTZ NOT NULL,
  periodo_fim TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscrição do usuário num concurso (1 por usuário por concurso).
CREATE TABLE IF NOT EXISTS inscricoes_concurso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 1000, -- snapshot do saldo de entrada (base do ROI)
  saldo_atual NUMERIC(12,2),
  posicao_atual INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, concurso_id)
);

-- Carteira ZC$ do concurso (saldo isolado por usuário+concurso).
CREATE TABLE IF NOT EXISTS concurso_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, concurso_id)
);

-- Palpites do concurso (parimutuel ZC$). `side` para binário, `outcome_id`
-- para multi. Sem FK em outcome_id (topic_outcomes só nasce na 014).
CREATE TABLE IF NOT EXISTS concurso_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  side bet_side,
  outcome_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  potential_payout NUMERIC(12,2),
  status bet_status NOT NULL DEFAULT 'matched',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_concurso ON inscricoes_concurso(concurso_id);
CREATE INDEX IF NOT EXISTS idx_concurso_wallets_lookup ON concurso_wallets(user_id, concurso_id);
CREATE INDEX IF NOT EXISTS idx_concurso_bets_topic ON concurso_bets(topic_id, concurso_id);
CREATE INDEX IF NOT EXISTS idx_concurso_bets_user ON concurso_bets(user_id, concurso_id);
CREATE INDEX IF NOT EXISTS idx_concursos_ativo ON concursos(status, periodo_inicio, periodo_fim);
