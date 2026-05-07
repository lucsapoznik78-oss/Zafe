--
-- 012 — Eventos únicos para Liga e Econômico (sem duplicatas)
-- Esta migração garante que não haverá duplicatas usando ON CONFLICT
-- Execute apenas uma vez. Se rodar novamente, não duplicará.
--

DO $$ DECLARE 
  admin_id UUID;
BEGIN
  -- Buscar admin
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado!'; END IF;

  RAISE NOTICE 'Admin ID: %', admin_id;
  RAISE NOTICE 'Inserindo eventos únicos (sem duplicatas)...';

  -- ============================================================
  -- LIGA - ESPORTES (5 eventos)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Flamengo vai vencer o próximo jogo?', 'Clássico carioca de mata-mata. Flamengo joga em casa.', 'esportes', 'active', 1, '2026-05-15 21:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Flamengo vai vencer o próximo jogo?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Palmeiras vai ganhar do São Paulo?', 'Choque-rei no Morumbi. Verdão é favorito fora de casa.', 'esportes', 'active', 1, '2026-05-18 16:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Palmeiras vai ganhar do São Paulo?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai vencer a Venezuela?', 'Seleção brasileira joga em casa pelas Eliminatórias.', 'esportes', 'active', 1, '2026-05-13 22:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai vencer a Venezuela?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Real Madrid vai eliminar o Bayern?', 'Quartas da Champions League. Duelo europeu decisivo.', 'esportes', 'active', 1, '2026-05-16 23:30:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Real Madrid vai eliminar o Bayern?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Corinthians vai se classificar?', 'Timão precisa vencer fora de casa na Libertadores.', 'esportes', 'active', 1, '2026-05-20 22:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Corinthians vai se classificar?' AND status = 'active' AND concurso_id IS NULL);

  -- ============================================================
  -- LIGA - POLÍTICA (4 eventos)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Quem vai ganhar a eleição 2026?', 'Disputa presidencial no Brasil. Lula tenta reeleição contra oposição.', 'politica', 'active', 1, '2026-10-05 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Quem vai ganhar a eleição 2026?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Congresso vai aprovar a reforma tributária?', 'PEC tramita no Senado. Aprovação em dois turnos.', 'politica', 'active', 1, '2026-05-30 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Congresso vai aprovar a reforma tributária?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O STF vai derrubar a taxação de fortunas?', 'Tema polêmico no Supremo. Corte decide sobre nova taxação.', 'politica', 'active', 1, '2026-05-22 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O STF vai derrubar a taxação de fortunas?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O governo vai aprovar a reforma da Previdência?', 'Nova reforma é prioridade do Executivo para 2026.', 'politica', 'active', 1, '2026-05-28 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O governo vai aprovar a reforma da Previdência?' AND status = 'active' AND concurso_id IS NULL);

  -- ============================================================
  -- LIGA - TECNOLOGIA (3 eventos)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Apple vai lançar iPhone dobrável?', 'Rumores indicam novo design revolucionário da Maçã em 2026.', 'tecnologia', 'active', 1, '2026-05-30 23:59:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Apple vai lançar iPhone dobrável?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O ChatGPT vai atingir 500 milhões de usuários?', 'OpenAI cresce acelerado. Meta de meio bilhão em maio.', 'tecnologia', 'active', 1, '2026-05-26 12:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O ChatGPT vai atingir 500 milhões de usuários?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai lançar satélite 6G próprio?', 'Projeto nacional avança com parcerias internacionais.', 'tecnologia', 'active', 1, '2026-05-20 10:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai lançar satélite 6G próprio?' AND status = 'active' AND concurso_id IS NULL);

  -- ============================================================
  -- LIGA - ENTRETENIMENTO (2 eventos)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O BBB 26 vai ter líder com 80% dos votos?', 'Votação em pauta na casa. Líder ganha apoio massivo?', 'entretenimento', 'active', 1, '2026-05-10 22:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O BBB 26 vai ter líder com 80% dos votos?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Filme brasileiro vai bater 1 milhão no streaming?', 'Produções nacionais ganham espaço global em maio.', 'entretenimento', 'active', 1, '2026-05-30 23:59:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Filme brasileiro vai bater 1 milhão no streaming?' AND status = 'active' AND concurso_id IS NULL);

  -- ============================================================
  -- ECONÔMICO (5 eventos)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O IPCA de abril vai ficar abaixo de 0,3%?', 'Inflação desacelera com queda em alimentos. IBGE surpreende positivamente?', 'economia', 'active', 1, '2026-05-11 09:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O IPCA de abril vai ficar abaixo de 0,3%?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O dólar vai fechar abaixo de R$ 5,70 em maio?', 'Cenário externo favorável e fluxo de capital estrangeiro pressionam o câmbio para baixo.', 'economia', 'active', 1, '2026-05-30 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O dólar vai fechar abaixo de R$ 5,70 em maio?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Ibovespa vai superar 145.000 pontos em maio?', 'Bolsa brasileira testa novo patamar com otimismo global e resultados trimestrais.', 'economia', 'active', 1, '2026-05-25 18:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Ibovespa vai superar 145.000 pontos em maio?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Petrobras vai anunciar novo aumento de combustíveis?', 'Pressão do mercado internacional e câmbio forçam a estatal a revisar preços.', 'economia', 'active', 1, '2026-05-14 12:00:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Petrobras vai anunciar novo aumento de combustíveis?' AND status = 'active' AND concurso_id IS NULL);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Bitcoin vai atingir US$ 95.000 até o fim de maio?', 'Criptoativo ganha tração com expectativa de cortes de juros nos EUA.', 'economia', 'active', 1, '2026-05-31 23:59:00+00', false, NULL
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Bitcoin vai atingir US$ 95.000 até o fim de maio?' AND status = 'active' AND concurso_id IS NULL);

  RAISE NOTICE 'Eventos inseridos sem duplicatas!';
  
  -- ============================================================
  -- VERIFICAR RESULTADO
  -- ============================================================
  RAISE NOTICE 'Total Liga: %', (SELECT COUNT(*) FROM topics WHERE status='active' AND concurso_id IS NULL AND category!='economia');
  RAISE NOTICE 'Total Econômico: %', (SELECT COUNT(*) FROM topics WHERE status='active' AND category='economia' AND concurso_id IS NULL);
  RAISE NOTICE 'Total Concurso: %', (SELECT COUNT(*) FROM topics WHERE status='active' AND concurso_id IS NOT NULL);

END $$;
