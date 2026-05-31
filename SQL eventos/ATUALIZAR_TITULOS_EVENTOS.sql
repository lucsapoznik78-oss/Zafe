--
-- ATUALIZAR TÍTULOS: Corrigir datas mencionadas nos títulos
-- Execute no SQL Editor do Supabase
--

-- ===========================================================
-- 1. LIGA (Esportes) - Corrigir títulos
-- ===========================================================

-- Flamengo x Grêmio (dia 10, não dia 7)
UPDATE topics 
SET title = 'O Flamengo vai vencer o Grêmio no dia 10?'
WHERE (title LIKE '%Flamengo%próximo jogo%' OR title LIKE '%Flamengo%Grêmio%')
  AND status = 'active';

-- Verificar se atualizou
SELECT 'Flamengo' as evento, title, closes_at 
FROM topics 
WHERE title LIKE '%Flamengo%' AND status = 'active';

-- Palmeiras x São Paulo (dia 28/maio)
UPDATE topics 
SET title = 'O Palmeiras vai ganhar do São Paulo no dia 28?'
WHERE title LIKE '%Palmeiras%São Paulo%' AND status = 'active';

-- Brasil x Venezuela (dia 10/junho)
UPDATE topics 
SET title = 'O Brasil vai vencer a Venezuela no dia 10/06?'
WHERE title LIKE '%Brasil%Venezuela%' AND status = 'active';

-- Real Madrid x Bayern (dia 30/maio)
UPDATE topics 
SET title = 'O Real Madrid vai eliminar o Bayern no dia 30?'
WHERE title LIKE '%Real Madrid%Bayern%' AND status = 'active';

-- Corinthians classificação (dia 15/junho)
UPDATE topics 
SET title = 'O Corinthians vai se classificar no dia 15/06?'
WHERE title LIKE '%Corinthians%classificar%' AND status = 'active';

-- ===========================================================
-- 2. LIGA (Política) - Corrigir títulos
-- ===========================================================

-- STF taxação fortunas (maio)
UPDATE topics 
SET title = 'O STF vai derrubar a taxação de fortunas em maio?'
WHERE title LIKE '%STF%fortunas%' AND status = 'active';

-- Congresso reforma tributária (maio)
UPDATE topics 
SET title = 'O Congresso vai aprovar a reforma tributária até o recesso?'
WHERE title LIKE '%Congresso%reforma tributária%' AND status = 'active';

-- Governo estímulo fiscal (maio)
UPDATE topics 
SET title = 'O governo vai anunciar novo pacote de estímulo fiscal?'
WHERE title LIKE '%governo%estímulo%' AND status = 'active';

-- TSE eleições 2026 (maio)
UPDATE topics 
SET title = 'O TSE vai aprovar novas regras para as eleições de 2026?'
WHERE title LIKE '%TSE%eleições%' AND status = 'active';

-- ===========================================================
-- 3. LIGA (Tecnologia) - Corrigir títulos
-- ===========================================================

-- Apple iPhone dobrável (maio)
UPDATE topics 
SET title = 'A Apple vai lançar iPhone dobrável em maio?'
WHERE title LIKE '%Apple%iPhone%' AND status = 'active';

-- ChatGPT 500 milhões (maio)
UPDATE topics 
SET title = 'O ChatGPT vai atingir 500 milhões de usuários em maio?'
WHERE title LIKE '%ChatGPT%500 milhões%' AND status = 'active';

-- Brasil satélite 6G (maio)
UPDATE topics 
SET title = 'O Brasil vai lançar satélite 6G próprio em maio?'
WHERE title LIKE '%Brasil%satélite%' AND status = 'active';

-- ===========================================================
-- 4. LIGA (Entretenimento) - Corrigir títulos
-- ===========================================================

-- BBB 26 líder 80% (maio)
UPDATE topics 
SET title = 'O BBB 26 vai ter líder com 80% dos votos?'
WHERE title LIKE '%BBB 26%líder%' AND status = 'active';

-- Filme brasileiro 1 milhão streaming (maio)
UPDATE topics 
SET title = 'Algum filme brasileiro vai bater 1 milhão no streaming em maio?'
WHERE title LIKE '%filme brasileiro%streaming%' AND status = 'active';

-- Spotify IA (maio)
UPDATE topics 
SET title = 'O Spotify vai lançar nova funcionalidade de IA no Brasil?'
WHERE title LIKE '%Spotify%IA%' AND status = 'active';

-- ===========================================================
-- 5. ECONÔMICO - Corrigir títulos
-- ===========================================================

-- IPCA abril (maio)
UPDATE topics 
SET title = 'O IPCA de abril vai ficar abaixo de 0,3%?'
WHERE title LIKE '%IPCA%abril%' AND status = 'active';

-- Dólar R$ 5,70 (maio)
UPDATE topics 
SET title = 'O dólar vai fechar abaixo de R$ 5,70 em maio?'
WHERE title LIKE '%dólar%5,70%' AND status = 'active';

-- Ibovespa 145.000 (maio)
UPDATE topics 
SET title = 'O Ibovespa vai superar 145.000 pontos em maio?'
WHERE title LIKE '%Ibovespa%145%' AND status = 'active';

-- Petrobras combustíveis (maio)
UPDATE topics 
SET title = 'A Petrobras vai anunciar novo aumento de combustíveis?'
WHERE title LIKE '%Petrobras%' AND status = 'active';

-- Bitcoin US$ 95.000 (maio)
UPDATE topics 
SET title = 'O Bitcoin vai atingir US$ 95.000 até o fim de maio?'
WHERE title LIKE '%Bitcoin%95.000%' AND status = 'active';

-- ===========================================================
-- 6. CONCURSO - Corrigir títulos (se houver)
-- ===========================================================

-- Copom Selic 0,50% (maio)
UPDATE topics 
SET title = 'O Copom vai cortar a Selic em 0,50% em maio?'
WHERE title LIKE '%Copom%Selic%' AND concurso_id IS NOT NULL;

-- Euro dólar paridade (maio)
UPDATE topics 
SET title = 'O euro vai superar o dólar em paridade até maio?'
WHERE title LIKE '%euro%dólar%' AND concurso_id IS NOT NULL;

-- China 5% (maio)
UPDATE topics 
SET title = 'A China vai crescer mais de 5% no segundo trimestre?'
WHERE title LIKE '%China%5%' AND concurso_id IS NOT NULL;

-- Ethereum US$ 5.000 (maio)
UPDATE topics 
SET title = 'O Ethereum vai superar US$ 5.000 em maio?'
WHERE title LIKE '%Ethereum%5.000%' AND concurso_id IS NOT NULL;

-- Impeachment Trump (maio)
UPDATE topics 
SET title = 'O impeachment de Trump avança no Congresso americano?'
WHERE title LIKE '%impeachment%Trump%' AND concurso_id IS NOT NULL;

-- ONU Saara (maio)
UPDATE topics 
SET title = 'A ONU vai intervir militarmente na crise do Saara?'
WHERE title LIKE '%ONU%Saara%' AND concurso_id IS NOT NULL;

-- Governo Lula Previdência (maio)
UPDATE topics 
SET title = 'O governo Lula vai aprovar a reforma da Previdência?'
WHERE title LIKE '%governo%Lula%Previdência%' AND concurso_id IS NOT NULL;

-- Tesla autônomo nível 5 (maio)
UPDATE topics 
SET title = 'A Tesla vai lançar carro autônomo nível 5 em maio?'
WHERE title LIKE '%Tesla%autônomo%' AND concurso_id IS NOT NULL;

-- Google OpenAI mercado IA (maio)
UPDATE topics 
SET title = 'O Google vai superar a OpenAI em participação de mercado de IA?'
WHERE title LIKE '%Google%OpenAI%' AND concurso_id IS NOT NULL;

-- Oscar 2026 filme brasileiro (maio)
UPDATE topics 
SET title = 'O Oscar 2026 terá filme brasileiro indicado?'
WHERE title LIKE '%Oscar 2026%filme brasileiro%' AND concurso_id IS NOT NULL;

-- Taylor Swift turnê (maio)
UPDATE topics 
SET title = 'A Taylor Swift vai anunciar nova turnê mundial em maio?'
WHERE title LIKE '%Taylor Swift%turnê%' AND concurso_id IS NOT NULL;

-- ===========================================================
-- 7. VERIFICAÇÃO FINAL: Listar todos os títulos ativos
-- ===========================================================

SELECT 
    title,
    category,
    closes_at as data,
    CASE 
        WHEN concurso_id IS NOT NULL THEN 'Concurso'
        WHEN category = 'economia' THEN 'Econômico'
        ELSE 'Liga'
    END as tipo
FROM topics
WHERE status = 'active'
  AND is_private = false
ORDER BY closes_at;

-- Se tudo estiver correto, os títulos e datas devem coincidir.
