--
-- LIMPEZA TOTAL: Remove TODAS as duplicatas da tabela topics
-- Mantém apenas 1 evento ativo por (title, category, concurso_id)
-- Execute no SQL Editor do Supabase
--

-- 1. VERIFICAR DUPLICATAS ANTES DA LIMPEZA
SELECT 
    'ANTES' as status,
    title, 
    category,
    concurso_id,
    COUNT(*) as qtd,
    STRING_AGG(id::text, ', ') as ids
FROM topics 
WHERE status = 'active' 
  AND is_private = false
GROUP BY title, category, concurso_id
HAVING COUNT(*) > 1
ORDER BY qtd DESC;

-- 2. DELETAR DUPLICATAS (manter apenas o mais antigo pelo created_at)
DELETE FROM topics 
WHERE id IN (
    SELECT id 
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY title, category, COALESCE(concurso_id, '00000000-0000-0000-0000-000000000000'::uuid) 
                ORDER BY created_at ASC
            ) as rn
        FROM topics 
        WHERE status = 'active' 
          AND is_private = false
    ) ranked
    WHERE ranked.rn > 1
);

-- 3. VERIFICAR SE AINDA RESTARAM DUPLICATAS
SELECT 
    'DEPOIS' as status,
    title, 
    category,
    concurso_id,
    COUNT(*) as qtd
FROM topics 
WHERE status = 'active' 
  AND is_private = false
GROUP BY title, category, concurso_id
HAVING COUNT(*) > 1;

-- 4. CONTAR EVENTOS POR TIPO
SELECT 
    CASE 
        WHEN concurso_id IS NOT NULL THEN 'Concurso'
        WHEN category = 'economia' THEN 'Econômico'
        ELSE 'Liga'
    END as tipo,
    COUNT(*) as total_ativos
FROM topics 
WHERE status = 'active'
GROUP BY 1
ORDER BY 1;

-- Se a consulta 3 não retornar linhas, todas as duplicatas foram removidas com sucesso.
