-- ============================================================
-- 022 — Diversifica os eventos do Concurso (estilo Polymarket/Kalshi)
-- ============================================================
-- O concurso estava muito concentrado em Copa do Mundo (16 eventos).
-- Reduz a Copa para os 5 mais populares e diversifica o leque com
-- eventos de política/eleição, cripto, mercados, ciência/espaço,
-- pop culture e clima — categorias variadas, binárias e simples,
-- inspiradas no mix de mercados do Polymarket e do Kalshi.
--
-- Os eventos ocultados NÃO são apagados: viram status 'cancelled'
-- (somem das listas) e só os que ainda não têm palpites.

DO $$ DECLARE
  admin_id UUID;
  concurso_ativo_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado.'; END IF;

  SELECT id INTO concurso_ativo_id FROM concursos WHERE status = 'ativo' LIMIT 1;
  IF concurso_ativo_id IS NULL THEN RAISE EXCEPTION 'Nenhum concurso ativo encontrado.'; END IF;

  -- ========== Reduzir a concentração em Copa (sem palpites) ==========
  -- Mantém só: estreia do Brasil, classificação do Brasil, 1º lugar do
  -- Brasil, jogo de abertura +2 gols e Messi marcar. Cancela o resto.
  UPDATE topics SET status = 'cancelled'
  WHERE concurso_id = concurso_ativo_id
    AND status = 'active'
    AND NOT EXISTS (SELECT 1 FROM concurso_bets cb WHERE cb.topic_id = topics.id)
    AND title IN (
      'A Argentina vai vencer o jogo de estreia na Copa do Mundo?',
      'A França vai se classificar para as oitavas de final da Copa?',
      'A Inglaterra vai se classificar para as oitavas de final da Copa?',
      'Portugal vai se classificar para as oitavas de final da Copa?',
      'A Espanha vai se classificar para as oitavas de final da Copa?',
      'A Seleção Brasileira vai terminar a fase de grupos invicta?',
      'O Brasil vai sofrer algum gol na fase de grupos da Copa?',
      'Vai ter goleada (4+ gols de diferença) na fase de grupos da Copa?',
      'Algum jogo vai ter 5 gols ou mais na fase de grupos da Copa?',
      'Neymar vai marcar um gol na fase de grupos da Copa do Mundo?',
      'Cristiano Ronaldo vai marcar um gol na fase de grupos da Copa?'
    );

  -- ========== Política / Eleição 2026 ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Lula vai liderar as pesquisas para a eleição presidencial de 2026?', 'É ano de eleição. A última pesquisa de junho vai mostrar Lula na frente da corrida presidencial?', 'politica', 'active', 20, '2026-06-30 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Lula vai liderar as pesquisas para a eleição presidencial de 2026?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Congresso vai derrubar algum veto presidencial em junho de 2026?', 'A queda de braço entre Congresso e Planalto. Os parlamentares derrubam algum veto de Lula em junho?', 'politica', 'active', 20, '2026-06-30 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Congresso vai derrubar algum veto presidencial em junho de 2026?' AND concurso_id = concurso_ativo_id);

  -- ========== Economia / Mercados ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Ibovespa vai bater um novo recorde histórico em junho de 2026?', 'A bolsa brasileira em alta. O Ibovespa atinge a maior pontuação da história durante junho?', 'economia', 'active', 20, '2026-06-30 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Ibovespa vai bater um novo recorde histórico em junho de 2026?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A gasolina vai ficar mais cara em junho de 2026?', 'No bolso de todo mundo. O preço médio da gasolina sobe em junho, segundo a ANP?', 'economia', 'active', 20, '2026-06-30 18:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A gasolina vai ficar mais cara em junho de 2026?' AND concurso_id = concurso_ativo_id);

  -- ========== Cripto ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Ethereum vai superar US$ 4.000 até o fim de junho de 2026?', 'A segunda maior criptomoeda do mundo. O Ethereum fecha junho acima de US$ 4 mil?', 'economia', 'active', 20, '2026-06-30 23:59:59+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Ethereum vai superar US$ 4.000 até o fim de junho de 2026?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Bitcoin vai cair abaixo de US$ 90 mil em junho de 2026?', 'Volatilidade no mercado cripto. O Bitcoin chega a bater abaixo de US$ 90 mil em algum momento de junho?', 'economia', 'active', 20, '2026-06-30 23:59:59+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Bitcoin vai cair abaixo de US$ 90 mil em junho de 2026?' AND concurso_id = concurso_ativo_id);

  -- ========== Ciência / Espaço ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A SpaceX vai lançar a Starship em junho de 2026?', 'O foguete mais poderoso do mundo. A SpaceX faz algum voo de teste da Starship durante junho?', 'tecnologia', 'active', 20, '2026-06-30 23:59:59+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A SpaceX vai lançar a Starship em junho de 2026?' AND concurso_id = concurso_ativo_id);

  -- ========== Pop culture ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Anitta vai aparecer em alguma parada global de música em junho de 2026?', 'A maior estrela pop do Brasil. Anitta emplaca uma música no ranking global do Spotify em junho?', 'entretenimento', 'active', 20, '2026-06-30 23:59:59+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Anitta vai aparecer em alguma parada global de música em junho de 2026?' AND concurso_id = concurso_ativo_id);

  -- ========== Clima ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Sul do Brasil vai registrar temperatura negativa em junho de 2026?', 'O inverno chegando com força. Alguma cidade do Sul marca temperatura abaixo de 0°C em junho?', 'outros', 'active', 20, '2026-06-30 23:59:59+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Sul do Brasil vai registrar temperatura negativa em junho de 2026?' AND concurso_id = concurso_ativo_id);

END $$;
