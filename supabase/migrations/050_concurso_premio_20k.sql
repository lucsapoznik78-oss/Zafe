-- ============================================================
-- 050 — Prêmio do Concurso: R$ 500 -> R$ 20.000
-- ============================================================
-- O código (landing/ConcursoAtivo, concurso/entrar, concurso/page) já exibia
-- R$ 500 apenas como FALLBACK (`premiacao_total ?? 500`), porque a coluna
-- `premiacao_total` nunca foi criada por migration e `premios` tinha DEFAULT
-- '[]' (nenhuma distribuição). Esta migration:
--   1. cria `concursos.premiacao_total` (DEFAULT 20000);
--   2. define o DEFAULT de `premios` com a distribuição de R$ 20.000, para que
--      os concursos mensais futuros criados por `garantir_concurso_do_mes()`
--      (migration 025, que herda os DEFAULTs) já nasçam com o prêmio correto;
--   3. atualiza o concurso ATIVO atual para R$ 20.000.
--
-- Distribuição (soma = R$ 20.000), no formato lido por finalizar-concurso
-- (`premioParaPosicao`): { posicao, valor } | { posicao_de, posicao_ate, valor }.
--   1º      : R$ 8.000
--   2º      : R$ 5.000
--   3º      : R$ 3.000
--   4º–5º   : R$ 2.000 cada  (= R$ 4.000)
--
-- ⚠️ COMPLIANCE: a Zafe se enquadra como fantasy sport pelo Art. 49 da
-- Lei 14.790/2023 — jogo de habilidade fora do regime de distribuição de
-- prêmios, sem exigência de autorização SECAP. O prêmio é FIXO (definido na
-- abertura, independente do número de inscritos), requisito do Art. 49. Apenas o
-- VALOR exibido muda aqui; o pagamento real em R$ via PIX e a integração do
-- provedor continuam pendentes (Fase 2). Prêmios sujeitos a IRRF na fonte.

-- 1) Coluna do prêmio total (idempotente).
ALTER TABLE concursos
  ADD COLUMN IF NOT EXISTS premiacao_total NUMERIC(12,2) NOT NULL DEFAULT 20000;

-- 2) Default da distribuição para os concursos mensais futuros.
ALTER TABLE concursos
  ALTER COLUMN premios SET DEFAULT '[
    {"posicao": 1, "valor": 8000},
    {"posicao": 2, "valor": 5000},
    {"posicao": 3, "valor": 3000},
    {"posicao_de": 4, "posicao_ate": 5, "valor": 2000}
  ]'::jsonb;

-- 3) Aplica ao(s) concurso(s) ainda ativo(s).
UPDATE concursos
SET premiacao_total = 20000,
    premios = '[
      {"posicao": 1, "valor": 8000},
      {"posicao": 2, "valor": 5000},
      {"posicao": 3, "valor": 3000},
      {"posicao_de": 4, "posicao_ate": 5, "valor": 2000}
    ]'::jsonb
WHERE status = 'ativo';
