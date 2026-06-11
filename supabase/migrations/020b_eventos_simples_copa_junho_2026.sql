-- ============================================================
-- 020 — Eventos simples e populares para o Concurso (Junho 2026)
-- ============================================================
-- Substitui eventos de nicho (lançamentos de Apple/OpenAI/Nvidia,
-- novela, bilheteria, índices) por eventos simples e populares —
-- foco na Copa do Mundo 2026 (11/06 a 19/07), cuja fase de grupos
-- resolve dentro do mês do concurso. Eventos do tipo "quem ganha a
-- eleição / a copa": binários, fáceis de palpitar, que todo mundo
-- entende. min_bet = 20 (padrão do concurso).
--
-- Os eventos ocultados NÃO são apagados: viram status 'cancelled'
-- (some das listas do concurso), e só os que ainda não têm palpites.

DO $$ DECLARE
  admin_id UUID;
  concurso_ativo_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado.'; END IF;

  SELECT id INTO concurso_ativo_id FROM concursos WHERE status = 'ativo' LIMIT 1;
  IF concurso_ativo_id IS NULL THEN RAISE EXCEPTION 'Nenhum concurso ativo encontrado.'; END IF;

  -- ========== Novos eventos: Copa do Mundo 2026 (esportes) ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai vencer o jogo de estreia na Copa do Mundo 2026?', 'A Seleção entra em campo na abertura da sua campanha. Começa com vitória?', 'esportes', 'active', 20, '2026-06-14 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai vencer o jogo de estreia na Copa do Mundo 2026?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai se classificar para as oitavas de final da Copa?', 'Fase de grupos da Copa do Mundo 2026. A Seleção avança para o mata-mata?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai se classificar para as oitavas de final da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai terminar a fase de grupos em primeiro lugar?', 'Liderança do grupo na Copa do Mundo 2026. A Seleção fica em 1º?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai terminar a fase de grupos em primeiro lugar?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Seleção Brasileira vai terminar a fase de grupos invicta?', 'Sem perder nenhum jogo na primeira fase da Copa. O Brasil passa invicto?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Seleção Brasileira vai terminar a fase de grupos invicta?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Argentina vai vencer o jogo de estreia na Copa do Mundo?', 'A atual campeã estreia na Copa do Mundo 2026. Os hermanos começam ganhando?', 'esportes', 'active', 20, '2026-06-14 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Argentina vai vencer o jogo de estreia na Copa do Mundo?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A França vai se classificar para as oitavas de final da Copa?', 'Uma das favoritas na Copa do Mundo 2026. Os franceses avançam da fase de grupos?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A França vai se classificar para as oitavas de final da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O jogo de abertura da Copa do Mundo vai ter mais de 2 gols?', 'A festa de abertura da Copa do Mundo 2026. Sai jogo com 3 gols ou mais?', 'esportes', 'active', 20, '2026-06-12 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O jogo de abertura da Copa do Mundo vai ter mais de 2 gols?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Vai ter goleada (4+ gols de diferença) na fase de grupos da Copa?', 'Primeira fase da Copa do Mundo 2026. Algum jogo termina com diferença de 4 gols ou mais?', 'esportes', 'active', 20, '2026-06-27 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Vai ter goleada (4+ gols de diferença) na fase de grupos da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Messi vai marcar um gol na fase de grupos da Copa do Mundo?', 'O craque argentino na Copa do Mundo 2026. Ele balança a rede na primeira fase?', 'esportes', 'active', 20, '2026-06-27 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Messi vai marcar um gol na fase de grupos da Copa do Mundo?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Cristiano Ronaldo vai marcar um gol na fase de grupos da Copa?', 'CR7 em mais uma Copa do Mundo. Ele marca na fase de grupos de 2026?', 'esportes', 'active', 20, '2026-06-27 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Cristiano Ronaldo vai marcar um gol na fase de grupos da Copa?' AND concurso_id = concurso_ativo_id);

  -- ========== Ocultar eventos de nicho sem palpites ==========
  -- Só cancela eventos que ainda não têm nenhum palpite no concurso.
  UPDATE topics SET status = 'cancelled'
  WHERE concurso_id = concurso_ativo_id
    AND status = 'active'
    AND NOT EXISTS (SELECT 1 FROM concurso_bets cb WHERE cb.topic_id = topics.id)
    AND title IN (
      'A Apple vai anunciar grandes novidades de IA na WWDC 2026?',
      'A OpenAI lançará publicamente o GPT-5 até o fim de junho de 2026?',
      'A OpenAI vai lançar um novo modelo em junho?',
      'A Nvidia vai superar US$ 4 trilhões em valor de mercado?',
      'A novela das 21h vai bater recorde de audiência em junho?',
      'Algum artista brasileiro vai estrear no top 10 global do Spotify?',
      'O novo filme da Marvel vai liderar a bilheteria mundial em junho?',
      'Uma produção nacional será o filme mais visto nos cinemas do Brasil em junho de 2026?',
      'O Ibovespa vai superar 140.000 pontos em junho?',
      'O IPCA de maio vai ficar abaixo de 0,4%?'
    );

END $$;
