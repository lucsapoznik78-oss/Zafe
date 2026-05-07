--
-- REMOVER TODOS OS EVENTOS DE TIMES ELIMINADOS DA CHAMPIONS
-- Real Madrid, Bayern, Manchester City já foram eliminados
-- Execute no SQL Editor do Supabase
--

-- ============================================================
-- 1. DELETAR TODOS OS EVENTOS DE TIMES ELIMINADOS
-- ============================================================

-- Real Madrid (eliminado)
DELETE FROM topics 
WHERE title LIKE '%Real Madrid%' AND status = 'active';

-- Bayern Munich (eliminado)
DELETE FROM topics 
WHERE title LIKE '%Bayern%' AND status = 'active';

-- Manchester City (eliminado)
DELETE FROM topics 
WHERE title LIKE '%Manchester City%' AND status = 'active';

-- PSG (já jogaram)
DELETE FROM topics 
WHERE title LIKE '%PSG%Bayern%' AND status = 'active';

-- Verificar se foram removidos
SELECT 'Times eliminados removidos' as status, COUNT(*) as restantes 
FROM topics 
WHERE title LIKE '%Real Madrid%' OR title LIKE '%Bayern%' OR title LIKE '%Manchester City%';

-- ============================================================
-- 2. INSERIR NOVOS EVENTOS DE FUTEBOL ATUAL (Brasileirão/Copas)
-- ============================================================

-- Brasileirão: Flamengo x Grêmio (10/maio, 21h)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Flamengo vai vencer o Grêmio no dia 10?',
    'Brasileirão 2026. Flamengo joga em casa no Maracanã.',
    'esportes',
    'active',
    1,
    '2026-05-10 21:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Flamengo vai vencer o Grêmio no dia 10?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- Brasileirão: Palmeiras x São Paulo (28/maio, 16h)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Palmeiras vai ganhar do São Paulo no dia 28?',
    'Choque-rei pelo Brasileirão. Verdão joga em casa.',
    'esportes',
    'active',
    1,
    '2026-05-28 16:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Palmeiras vai ganhar do São Paulo no dia 28?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- Copa do Brasil: Corinthians x Bahia (15/junho, 22h)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Corinthians vai se classificar contra o Bahia no dia 15/06?',
    'Copa do Brasil. Timão joga fora de casa.',
    'esportes',
    'active',
    1,
    '2026-06-15 22:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Corinthians vai se classificar contra o Bahia no dia 15/06?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- Eliminatórias: Brasil x Argentina (10/junho, 22h)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Brasil vai vencer a Argentina no dia 10/06?',
    'Eliminatórias Copa 2026. Clássico sul-americano.',
    'esportes',
    'active',
    1,
    '2026-06-10 22:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Brasil vai vencer a Argentina no dia 10/06?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- ============================================================
-- 3. VERIFICAÇÃO FINAL: Listar todos os eventos ativos de esportes
-- ============================================================

SELECT 
    title,
    category,
    closes_at as data_evento,
    CASE 
        WHEN closes_at < NOW() THEN '⚠️ AINDA NO PASSADO'
        ELSE '✅ Futuro - OK'
    END as status_data
FROM topics
WHERE status = 'active' 
  AND category = 'esportes'
  AND is_private = false
ORDER BY closes_at;

-- Se não houver eventos no passado, tudo correto!
