--
-- CORREÇÃO FINAL: TODOS OS EVENTOS COM DATAS ERRADAS
-- Execute no SQL Editor do Supabase
--

-- ============================================================
-- 1. DELETAR EVENTOS JÁ REALIZADOS (que não existem mais)
-- ============================================================

-- GP Miami F1 (já aconteceu em 4/maio)
DELETE FROM topics 
WHERE title LIKE '%Miami%' OR title LIKE '%Fórmula 1%Miami%';

-- ============================================================
-- 2. CORRIGIR TÍTULOS E DATAS (Liga Esportes)
-- ============================================================

-- Flamengo x Grêmio (dia 10/maio, 21h) - título exato
UPDATE topics 
SET closes_at = '2026-05-10 21:00:00+00'
WHERE title = 'O Flamengo vai vencer o próximo jogo?' 
  AND status = 'active';

-- Se o título for diferente, tentar outros padrões
UPDATE topics 
SET closes_at = '2026-05-10 21:00:00+00'
WHERE (title LIKE '%Flamengo%Grêmio%' OR title LIKE '%Flamengo%próximo jogo%')
  AND status = 'active';

-- Palmeiras x São Paulo (dia 28/maio, 16h)
UPDATE topics 
SET closes_at = '2026-05-28 16:00:00+00'
WHERE title LIKE '%Palmeiras%São Paulo%' AND status = 'active';

-- Brasil x Venezuela (dia 10/junho, 22h)
UPDATE topics 
SET closes_at = '2026-06-10 22:00:00+00'
WHERE title LIKE '%Brasil%Venezuela%' AND status = 'active';

-- Real Madrid x Bayern (dia 30/maio, 23h30)
UPDATE topics 
SET closes_at = '2026-05-30 23:30:00+00'
WHERE title LIKE '%Real Madrid%Bayern%' AND status = 'active';

-- Corinthians classificação (dia 15/junho, 22h)
UPDATE topics 
SET closes_at = '2026-06-15 22:00:00+00'
WHERE title LIKE '%Corinthians%classificar%' AND status = 'active';

-- ============================================================
-- 3. CORRIGIR DATAS (Econômico)
-- ============================================================

-- IPCA abril (já saiu, manter para resolver em maio)
UPDATE topics 
SET closes_at = '2026-05-11 09:00:00+00'
WHERE title LIKE '%IPCA%abril%' AND status = 'active';

-- Dólar R$ 5,70 (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-30 18:00:00+00'
WHERE title LIKE '%dólar%5,70%' AND status = 'active';

-- Ibovespa 145k (maio)
UPDATE topics 
SET closes_at = '2026-05-25 18:00:00+00'
WHERE title LIKE '%Ibovespa%145%' AND status = 'active';

-- Petrobras combustíveis (maio)
UPDATE topics 
SET closes_at = '2026-05-14 12:00:00+00'
WHERE title LIKE '%Petrobras%' AND status = 'active';

-- Bitcoin US$ 95k (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-31 23:59:00+00'
WHERE title LIKE '%Bitcoin%95.000%' AND status = 'active';

-- ============================================================
-- 4. CORRIGIR DATAS (Política)
-- ============================================================

-- STF taxação fortunas (maio)
UPDATE topics 
SET closes_at = '2026-05-20 18:00:00+00'
WHERE title LIKE '%STF%fortunas%' AND status = 'active';

-- Congresso reforma tributária (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-30 18:00:00+00'
WHERE title LIKE '%Congresso%reforma tributária%' AND status = 'active';

-- Governo estímulo fiscal (maio)
UPDATE topics 
SET closes_at = '2026-05-16 15:00:00+00'
WHERE title LIKE '%governo%estímulo%' AND status = 'active';

-- TSE eleições 2026 (maio)
UPDATE topics 
SET closes_at = '2026-05-22 18:00:00+00'
WHERE title LIKE '%TSE%eleições%' AND status = 'active';

-- ============================================================
-- 5. CORRIGIR DATAS (Tecnologia)
-- ============================================================

-- Apple iPhone dobrável (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-30 23:59:00+00'
WHERE title LIKE '%Apple%iPhone%' AND status = 'active';

-- ChatGPT 500 milhões (maio)
UPDATE topics 
SET closes_at = '2026-05-26 12:00:00+00'
WHERE title LIKE '%ChatGPT%500 milhões%' AND status = 'active';

-- Brasil satélite 6G (maio)
UPDATE topics 
SET closes_at = '2026-05-20 10:00:00+00'
WHERE title LIKE '%Brasil%satélite%' AND status = 'active';

-- ============================================================
-- 6. CORRIGIR DATAS (Entretenimento)
-- ============================================================

-- BBB 26 líder 80% (maio)
UPDATE topics 
SET closes_at = '2026-05-10 22:00:00+00'
WHERE title LIKE '%BBB 26%líder%' AND status = 'active';

-- Filme brasileiro 1 milhão (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-30 23:59:00+00'
WHERE title LIKE '%filme brasileiro%1 milhão%' AND status = 'active';

-- Spotify IA (maio)
UPDATE topics 
SET closes_at = '2026-05-20 12:00:00+00'
WHERE title LIKE '%Spotify%IA%' AND status = 'active';

-- ============================================================
-- 7. CORRIGIR DATAS (Concurso - se houver)
-- ============================================================

-- Copom Selic 0,50% (maio)
UPDATE topics 
SET closes_at = '2026-05-07 18:00:00+00'
WHERE title LIKE '%Copom%Selic%0,50%' AND concurso_id IS NOT NULL;

-- Euro dólar paridade (maio)
UPDATE topics 
SET closes_at = '2026-05-20 18:00:00+00'
WHERE title LIKE '%euro%dólar%' AND concurso_id IS NOT NULL;

-- China 5% (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-28 23:59:00+00'
WHERE title LIKE '%China%5%' AND concurso_id IS NOT NULL;

-- Ethereum US$ 5.000 (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-30 23:59:00+00'
WHERE title LIKE '%Ethereum%5.000%' AND concurso_id IS NOT NULL;

-- Impeachment Trump (maio)
UPDATE topics 
SET closes_at = '2026-05-14 18:00:00+00'
WHERE title LIKE '%impeachment%Trump%' AND concurso_id IS NOT NULL;

-- ONU Saara (maio)
UPDATE topics 
SET closes_at = '2026-05-22 18:00:00+00'
WHERE title LIKE '%ONU%Saara%' AND concurso_id IS NOT NULL;

-- Governo Lula Previdência (maio)
UPDATE topics 
SET closes_at = '2026-05-26 18:00:00+00'
WHERE title LIKE '%governo%Lula%Previdência%' AND concurso_id IS NOT NULL;

-- Tesla autônomo (maio)
UPDATE topics 
SET closes_at = '2026-05-18 12:00:00+00'
WHERE title LIKE '%Tesla%autônomo%' AND concurso_id IS NOT NULL;

-- Google OpenAI (maio)
UPDATE topics 
SET closes_at = '2026-05-24 12:00:00+00'
WHERE title LIKE '%Google%OpenAI%' AND concurso_id IS NOT NULL;

-- Oscar 2026 filme brasileiro (fim de maio)
UPDATE topics 
SET closes_at = '2026-05-28 23:59:00+00'
WHERE title LIKE '%Oscar 2026%filme brasileiro%' AND concurso_id IS NOT NULL;

-- Taylor Swift turnê (maio)
UPDATE topics 
SET closes_at = '2026-05-16 18:00:00+00'
WHERE title LIKE '%Taylor Swift%turnê%' AND concurso_id IS NOT NULL;

-- ============================================================
-- 8. VERIFICAÇÃO FINAL: LISTAR TODOS OS EVENTOS ATIVOS
-- ============================================================

SELECT 
    title,
    category,
    closes_at as data_evento,
    CASE 
        WHEN concurso_id IS NOT NULL THEN 'Concurso'
        WHEN category = 'economia' THEN 'Econômico'
        ELSE 'Liga'
    END as tipo,
    CASE 
        WHEN closes_at < NOW() THEN '⚠️ AINDA NO PASSADO - VERIFICAR'
        ELSE '✅ Futuro - OK'
    END as status_data
FROM topics
WHERE status = 'active'
  AND is_private = false
ORDER BY closes_at;

-- ============================================================
-- 9. MOVER EVENTOS NO PASSADO PARA 'resolving'
-- ============================================================

UPDATE topics 
SET status = 'resolving'
WHERE status = 'active' 
  AND closes_at < NOW()
  AND is_private = false
  AND concurso_id IS NULL;

SELECT 'Eventos movidos para resolving' as status, COUNT(*) as total 
FROM topics 
WHERE status = 'resolving' AND concurso_id IS NULL;
