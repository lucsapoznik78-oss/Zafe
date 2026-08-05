--
-- TROCAR EVENTOS QUE NÃO FAZEM SENTIDO POR OUTROS RELEVANTES
-- Execute no SQL Editor do Supabase
--

-- ============================================================
-- 1. DELETAR EVENTOS QUE NÃO FAZEM SENTIDO
-- ============================================================

-- Real Madrid x Bayern (já jogaram, Bayern eliminado)
DELETE FROM topics 
WHERE title LIKE '%Real Madrid%Bayern%' AND status = 'active';

-- Verificar se foi deletado
SELECT 'Real x Bayern removido' as status, COUNT(*) as restantes 
FROM topics WHERE title LIKE '%Real Madrid%Bayern%';

-- ============================================================
-- 2. INSERIR NOVOS EVENTOS RELEVANTES (Liga Esportes)
-- ============================================================

-- Substituto: Flamengo x Grêmio (dia 10/maio, 21h) - título já existe, apenas confirmar
-- Novo: Palmeiras x Fortaleza (dia 12/maio, 16h)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Palmeiras vai ganhar do Fortaleza no dia 12?',
    'Palmeiras joga em casa pelo Brasileirão. Verdão favorito.',
    'esportes',
    'active',
    1,
    '2026-05-12 16:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Palmeiras vai ganhar do Fortaleza no dia 12?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- Novo: Brasil x Ecuador (dia 15/junho, 22h - Eliminatórias)
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'O Brasil vai ganhar do Ecuador no dia 15/06?',
    'Seleção brasileira joga em casa pelas Eliminatórias.',
    'esportes',
    'active',
    1,
    '2026-06-15 22:00:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'O Brasil vai ganhar do Ecuador no dia 15/06?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- ============================================================
-- 3. TECNOLOGIA: Substituir Apple iPhone dobrável (ainda não anunciado)
-- ============================================================

-- Deletar Apple iPhone dobrável (especulação sem data certa)
DELETE FROM topics 
WHERE title LIKE '%Apple%iPhone%doibrável%' AND status = 'active';

-- Novo: Tesla vai dominar mercado de baterias em 2026?
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'A Tesla vai dominar mercado de baterias em 2026?',
    'Tesla amplia produção de baterias mais baratas. Mercado reage?',
    'tecnologia',
    'active',
    1,
    '2026-12-31 23:59:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'A Tesla vai dominar mercado de baterias em 2026?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- ============================================================
-- 4. ENTRETENIMENTO: Substituir BBB 26 (anada complicada)
-- ============================================================

-- Deletar BBB 26 líder 80%
DELETE FROM topics 
WHERE title LIKE '%BBB 26%líder%' AND status = 'active';

-- Novo: Netflix vai superar 300M de assinantes em maio?
INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
SELECT 
    '89aee166-8ccd-4511-8082-8848925d60db',
    'A Netflix vai superar 300M de assinantes em maio?',
    'Streaming gigante cresce acelerado. Meta de assinantes em maio?',
    'entretenimento',
    'active',
    1,
    '2026-05-30 23:59:00+00',
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM topics 
    WHERE title = 'A Netflix vai superar 300M de assinantes em maio?' 
      AND status = 'active' 
      AND concurso_id IS NULL
);

-- ============================================================
-- 5. POLÍTICA: Ajustar títulos para fazer mais sentido
-- ============================================================

-- Atualizar título do STF (tribunais → STF específico)
UPDATE topics 
SET title = 'O STF vai derrubar a taxação de fortunas em maio?'
WHERE title LIKE '%STF%fortunas%' AND status = 'active';

-- Atualizar título do Congresso (reforma tributária até recesso)
UPDATE topics 
SET title = 'O Congresso vai aprovar a reforma tributária até junho?'
WHERE title LIKE '%Congresso%reforma tributária%' AND status = 'active';

-- ============================================================
-- 6. ECONÔMICO: Manter, mas ajustar datas se necessário
-- ============================================================

-- IPCA abril (já foi, manter para resolver)
UPDATE topics 
SET closes_at = '2026-05-11 09:00:00+00'
WHERE title LIKE '%IPCA%abril%' AND status = 'active';

-- ============================================================
-- 7. VERIFICAÇÃO FINAL: Listar todos os eventos ativos
-- ============================================================

SELECT 
    title,
    category,
    closes_at as data,
    CASE 
        WHEN concurso_id IS NOT NULL THEN 'Concurso'
        WHEN category = 'economia' THEN 'Econômico'
        ELSE 'Liga'
    END as tipo,
    CASE 
        WHEN closes_at < NOW() THEN '⚠️ PASSADO - verificar'
        ELSE '✅ Futuro - OK'
    END as status_data
FROM topics
WHERE status = 'active'
  AND is_private = false
ORDER BY closes_at;

-- Se tudo estiver correto, não haverá eventos no passado.
