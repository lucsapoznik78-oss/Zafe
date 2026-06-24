-- 048_categorias_fantasy.sql
-- Pivot fantasy (Art. 49, Lei 14.790/2023): eventos só de esporte e e-sports.
-- Adiciona o valor 'esports' ao enum topic_category e troca os defaults de
-- 'outros' para 'esportes'. NÃO removemos valores antigos do enum (Postgres não
-- remove valor de enum facilmente, e há linhas históricas que os referenciam) —
-- apenas paramos de criar eventos fora de {esportes, esports} no app.
--
-- ATENÇÃO (rodar manualmente no Supabase SQL editor, statement a statement):
-- "ALTER TYPE ... ADD VALUE" não roda dentro de transação e o valor novo não
-- pode ser usado na mesma transação em que foi criado.

-- 1) novo valor do enum
ALTER TYPE topic_category ADD VALUE IF NOT EXISTS 'esports';

-- 2) defaults passam a 'esportes' (rodar numa execução separada do passo 1)
ALTER TABLE topics ALTER COLUMN category SET DEFAULT 'esportes';
-- topic_templates.category não tem default no schema; nada a fazer.

-- ───────────────────────────────────────────────────────────────────────────
-- SANEAMENTO DE EVENTOS LEGADOS (NÃO automatizado aqui de propósito)
-- Eventos antigos de politica/cultura/economia/tecnologia/entretenimento ainda
-- existem no banco. NÃO deletar em prod. O caminho correto:
--   1. conferir quais têm apostas/ordens abertas;
--   2. para os ativos, cancelar (status='cancelled') e reembolsar em Z$ via a
--      lógica do app (reembolsarTodos / payout), nunca por UPDATE cru;
--   3. deixar os já resolvidos como histórico.
-- Consulta de apoio (somente leitura) para listar os legados ativos:
--   SELECT id, title, category, status FROM topics
--   WHERE category NOT IN ('esportes','esports') AND status IN ('active','pending','resolving');
