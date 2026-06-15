-- ============================================================
-- ZAFE — Migration 039: Premium (estrutura, sem pagamento/PIX)
-- ============================================================
-- Adiciona o tier Premium: flag no perfil (ativação manual via admin nesta
-- fase) e a tabela de insights por evento gerados por IA (perk exclusivo).
-- A cobrança/PIX fica fora de escopo e pluga depois sem refazer nada.

-- Flag de assinatura no perfil.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
-- premium_until NULL = vitalício enquanto is_premium = true.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

-- Insights exclusivos por evento (resumo, pesquisas, histórico, contexto)
-- gerados por IA e cacheados. Conteúdo é perk Premium — o gate de leitura
-- fica na camada de API (esta tabela só é lida pelo service_role).
CREATE TABLE IF NOT EXISTS topic_insights (
  topic_id     UUID PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  content      JSONB NOT NULL,
  model        TEXT,
  status       TEXT NOT NULL DEFAULT 'ok',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS habilitado SEM policy de SELECT para anon/authenticated:
-- ninguém lê direto pelo banco; só o service_role (createAdminClient) acessa,
-- e a API decide o que devolve (completo p/ Premium, teaser p/ free).
ALTER TABLE topic_insights ENABLE ROW LEVEL SECURITY;
