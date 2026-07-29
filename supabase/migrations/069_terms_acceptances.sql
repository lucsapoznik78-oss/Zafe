-- 069 — trilha probatória de aceite dos documentos legais
--
-- Hoje o aceite mora em `profiles.terms_version` / `terms_accepted_at`
-- (migration 052). Isso não serve como prova: são campos mutáveis, sem IP, sem
-- user-agent, sem o texto que foi aceito e sem histórico. Se o texto de /termos
-- muda, o texto anterior deixa de existir — e com ele a possibilidade de provar
-- o conteúdo do contrato (CDC art. 46; CC art. 434; MP 2.200-2/2001, § 2º, que
-- exige que o meio comprove autoria E integridade).
--
-- Duas tabelas:
--   legal_documents   — arquivo imutável de cada versão publicada, com o texto
--                       renderizado e o SHA-256 dele.
--   terms_acceptances — uma linha append-only por (usuário, documento, versão,
--                       ato), com IP e user-agent do request.
--
-- `profiles.terms_version` continua sendo escrita como cache de leitura rápida,
-- mas a prova passa a ser terms_acceptances.
--
-- Aditiva: nada quebra por aplicá-la antes do deploy do código.

-- ============================================================
-- legal_documents — arquivo das versões publicadas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
  document            text        NOT NULL CHECK (document IN ('termos','politica','regulamento_concurso')),
  version             text        NOT NULL,   -- data ISO da versão, ex: '2026-07-28'
  document_hash       text        NOT NULL,   -- SHA-256 hex do texto normalizado
  effective_from      timestamptz NOT NULL,
  summary_of_changes  text,
  content_md          text        NOT NULL,   -- snapshot do texto renderizado
  archived_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document, version)
);

CREATE INDEX IF NOT EXISTS legal_documents_vigente_idx
  ON public.legal_documents (document, effective_from DESC);

-- As versões antigas são públicas: qualquer pessoa (inclusive um juiz, sem
-- login) precisa poder ler o texto que estava no ar numa data.
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_documents_select_publico ON public.legal_documents;
CREATE POLICY legal_documents_select_publico
  ON public.legal_documents FOR SELECT
  USING (true);

-- ============================================================
-- terms_acceptances — o ato de aceite
-- ============================================================

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document        text        NOT NULL CHECK (document IN ('termos','politica','regulamento_concurso')),
  version         text        NOT NULL,
  document_hash   text        NOT NULL,
  action          text        NOT NULL CHECK (action IN ('signup','contest_entry','reaccept','contest_refunded')),
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip              inet,
  user_agent      text,
  contest_edition text,       -- ex: '2026-09', só em contest_entry/contest_refunded
  metadata        jsonb
);

CREATE INDEX IF NOT EXISTS terms_acceptances_user_idx
  ON public.terms_acceptances (user_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS terms_acceptances_doc_idx
  ON public.terms_acceptances (document, version);

-- Idempotência: aceitar duas vezes a MESMA versão do MESMO documento no mesmo
-- ato é o mesmo aceite (retry de request, duas abas). Já contest_entry pode
-- repetir legitimamente — uma vez por edição do concurso.
CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptances_unico_idx
  ON public.terms_acceptances (user_id, document, version, action)
  WHERE action IN ('signup','reaccept');

CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptances_edicao_idx
  ON public.terms_acceptances (user_id, document, action, contest_edition)
  WHERE action = 'contest_entry';

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- O usuário lê o próprio histórico de aceites (LGPD art. 18, II — acesso).
DROP POLICY IF EXISTS terms_acceptances_select_proprio ON public.terms_acceptances;
CREATE POLICY terms_acceptances_select_proprio
  ON public.terms_acceptances FOR SELECT
  USING (user_id = auth.uid());

-- Nenhuma policy de INSERT/UPDATE/DELETE: gravação só pelo service role, de
-- dentro de rotas server-side (lib/legal.ts).
REVOKE INSERT, UPDATE, DELETE ON public.terms_acceptances FROM anon, authenticated;

-- ============================================================
-- Append-only de verdade
-- ============================================================
-- RLS não se aplica ao service role, então uma policy não é suficiente para
-- garantir imutabilidade — e é exatamente a imutabilidade que dá valor
-- probatório à tabela. O trigger vale para todos, inclusive o service role.

CREATE OR REPLACE FUNCTION public.bloquear_alteracao_legal()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    '% é append-only: linhas de aceite/versão legal não podem ser alteradas nem removidas',
    TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terms_acceptances_append_only ON public.terms_acceptances;
CREATE TRIGGER terms_acceptances_append_only
  BEFORE UPDATE OR DELETE ON public.terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_legal();

-- Em legal_documents o INSERT segue livre (arquivar versão nova), mas alterar
-- uma versão já arquivada não: se o texto mudou, é uma versão nova.
DROP TRIGGER IF EXISTS legal_documents_append_only ON public.legal_documents;
CREATE TRIGGER legal_documents_append_only
  BEFORE UPDATE OR DELETE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_legal();

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS terms_acceptances_append_only ON public.terms_acceptances;
-- DROP TRIGGER IF EXISTS legal_documents_append_only ON public.legal_documents;
-- DROP FUNCTION IF EXISTS public.bloquear_alteracao_legal();
-- DROP TABLE IF EXISTS public.terms_acceptances;
-- DROP TABLE IF EXISTS public.legal_documents;
