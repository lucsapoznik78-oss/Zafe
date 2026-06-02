-- ============================================================
-- 019 — 20 novos eventos para o Concurso (Junho 2026)
-- ============================================================
-- Insere 20 eventos vinculados ao concurso ativo (concurso_id).
-- min_bet = 20 (padrão do concurso). Só cria se houver concurso ativo
-- e se o evento ainda não existir nesse concurso.

DO $$ DECLARE
  admin_id UUID;
  concurso_ativo_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado.'; END IF;

  SELECT id INTO concurso_ativo_id FROM concursos WHERE status = 'ativo' LIMIT 1;
  IF concurso_ativo_id IS NULL THEN RAISE EXCEPTION 'Nenhum concurso ativo encontrado.'; END IF;

  -- ========== Eventos Esportes (min_bet = 20) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai vencer a Argentina nas Eliminatórias?', 'Clássico sul-americano decisivo. A Seleção supera os hermanos em casa?', 'esportes', 'active', 20, '2026-06-10 22:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai vencer a Argentina nas Eliminatórias?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Flamengo vai liderar o Brasileirão ao fim de junho?', 'Mengão briga na ponta da tabela. Termina o mês na liderança isolada?', 'esportes', 'active', 20, '2026-06-30 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Flamengo vai liderar o Brasileirão ao fim de junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Palmeiras vai vencer o Dérbi contra o Corinthians?', 'Clássico paulista de peso. Verdão leva a melhor sobre o Timão?', 'esportes', 'active', 20, '2026-06-15 21:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Palmeiras vai vencer o Dérbi contra o Corinthians?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Seleção Brasileira vai golear o Paraguai?', 'Eliminatórias seguem e o Brasil busca vitória elástica. Goleada confirmada?', 'esportes', 'active', 20, '2026-06-18 22:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Seleção Brasileira vai golear o Paraguai?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Botafogo vai se classificar nas oitavas da Libertadores?', 'Fogão depende de resultado para avançar. Vaga garantida na fase de mata-mata?', 'esportes', 'active', 20, '2026-06-25 22:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Botafogo vai se classificar nas oitavas da Libertadores?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  -- ========== Eventos Economia (min_bet = 20) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Copom vai manter a Selic na reunião de junho?', 'Comitê avalia cenário de inflação e atividade. Taxa segue inalterada?', 'economia', 'active', 20, '2026-06-18 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Copom vai manter a Selic na reunião de junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O dólar vai fechar junho abaixo de R$ 5,50?', 'Fluxo externo e juros pressionam o câmbio. Real se valoriza no mês?', 'economia', 'active', 20, '2026-06-30 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O dólar vai fechar junho abaixo de R$ 5,50?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O IPCA de maio vai ficar abaixo de 0,4%?', 'IBGE divulga a inflação do mês. Os preços desaceleram além do esperado?', 'economia', 'active', 20, '2026-06-11 09:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O IPCA de maio vai ficar abaixo de 0,4%?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Ibovespa vai superar 140.000 pontos em junho?', 'Bolsa testa novo recorde com otimismo do mercado. Marco atingido no mês?', 'economia', 'active', 20, '2026-06-27 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Ibovespa vai superar 140.000 pontos em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Bitcoin vai superar US$ 100.000 em junho?', 'Criptoativo embala com fluxo institucional. A barreira psicológica cai no mês?', 'economia', 'active', 20, '2026-06-30 23:59:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Bitcoin vai superar US$ 100.000 em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  -- ========== Eventos Política (min_bet = 20) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Congresso vai aprovar o novo arcabouço fiscal em junho?', 'Texto tramita em regime de urgência. Câmara e Senado concluem a votação no mês?', 'politica', 'active', 20, '2026-06-26 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Congresso vai aprovar o novo arcabouço fiscal em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O STF vai concluir o julgamento sobre o marco temporal?', 'Supremo retoma pauta sensível. A Corte finaliza o julgamento ainda em junho?', 'politica', 'active', 20, '2026-06-20 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O STF vai concluir o julgamento sobre o marco temporal?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O governo vai anunciar reforma ministerial em junho?', 'Articulação política esquenta. Executivo mexe na Esplanada antes do recesso?', 'politica', 'active', 20, '2026-06-15 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O governo vai anunciar reforma ministerial em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A regulamentação da reforma tributária vai sair até o fim de junho?', 'Leis complementares correm contra o tempo. Regras detalhadas saem no mês?', 'politica', 'active', 20, '2026-06-28 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A regulamentação da reforma tributária vai sair até o fim de junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  -- ========== Eventos Tecnologia (min_bet = 20) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Apple vai anunciar grandes novidades de IA na WWDC 2026?', 'Conferência anual da Maçã promete foco em inteligência artificial. Surpresa confirmada?', 'tecnologia', 'active', 20, '2026-06-09 20:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Apple vai anunciar grandes novidades de IA na WWDC 2026?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A OpenAI vai lançar um novo modelo em junho?', 'Ritmo acelerado de lançamentos. A empresa apresenta nova versão ao público no mês?', 'tecnologia', 'active', 20, '2026-06-22 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A OpenAI vai lançar um novo modelo em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Nvidia vai superar US$ 4 trilhões em valor de mercado?', 'Gigante dos chips dispara com demanda por IA. Novo marco histórico no mês?', 'tecnologia', 'active', 20, '2026-06-30 20:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Nvidia vai superar US$ 4 trilhões em valor de mercado?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  -- ========== Eventos Entretenimento (min_bet = 20) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O novo filme da Marvel vai liderar a bilheteria mundial em junho?', 'Estreia badalada nos cinemas. A produção fica no topo das bilheterias do mês?', 'entretenimento', 'active', 20, '2026-06-21 23:59:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O novo filme da Marvel vai liderar a bilheteria mundial em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A novela das 21h vai bater recorde de audiência em junho?', 'Trama no ar promete reviravoltas. O capítulo do mês supera a marca da temporada?', 'entretenimento', 'active', 20, '2026-06-28 23:59:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A novela das 21h vai bater recorde de audiência em junho?' AND status = 'active' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Algum artista brasileiro vai estrear no top 10 global do Spotify?', 'Música brasileira ganha o mundo. Um nome nacional entra no top 10 global no mês?', 'entretenimento', 'active', 20, '2026-06-25 23:59:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Algum artista brasileiro vai estrear no top 10 global do Spotify?' AND status = 'active' AND concurso_id = concurso_ativo_id);

END $$;
