-- ============================================================
-- 021 — Remove duplicatas de economia e adiciona novos eventos
-- ============================================================
-- O concurso de junho/2026 tinha eventos econômicos duplicados
-- (duas Selic, dois dólar, dois Bitcoin). Mantém uma versão de cada
-- e oculta as duplicatas (status 'cancelled', só as sem palpites).
-- Adiciona mais eventos populares da Copa do Mundo 2026.

DO $$ DECLARE
  admin_id UUID;
  concurso_ativo_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado.'; END IF;

  SELECT id INTO concurso_ativo_id FROM concursos WHERE status = 'ativo' LIMIT 1;
  IF concurso_ativo_id IS NULL THEN RAISE EXCEPTION 'Nenhum concurso ativo encontrado.'; END IF;

  -- ========== Ocultar duplicatas de economia (sem palpites) ==========
  UPDATE topics SET status = 'cancelled'
  WHERE concurso_id = concurso_ativo_id
    AND status = 'active'
    AND NOT EXISTS (SELECT 1 FROM concurso_bets cb WHERE cb.topic_id = topics.id)
    AND title IN (
      'A Selic será cortada na próxima reunião do Copom de junho de 2026?',
      'O dólar fechará junho de 2026 abaixo de R$ 5,00?',
      'O Bitcoin vai superar US$ 100.000 em junho?'
    );

  -- ========== Novos eventos populares — Copa do Mundo 2026 ==========
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Inglaterra vai se classificar para as oitavas de final da Copa?', 'Sempre entre as favoritas. Os ingleses avançam da fase de grupos em 2026?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Inglaterra vai se classificar para as oitavas de final da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Portugal vai se classificar para as oitavas de final da Copa?', 'Com CR7 em campo, os portugueses passam da primeira fase da Copa 2026?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Portugal vai se classificar para as oitavas de final da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'A Espanha vai se classificar para as oitavas de final da Copa?', 'A campeã da Eurocopa na Copa do Mundo 2026. Os espanhóis avançam da fase de grupos?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'A Espanha vai se classificar para as oitavas de final da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'O Brasil vai sofrer algum gol na fase de grupos da Copa?', 'A defesa da Seleção na Copa do Mundo 2026. O Brasil leva pelo menos um gol na primeira fase?', 'esportes', 'active', 20, '2026-06-28 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'O Brasil vai sofrer algum gol na fase de grupos da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Algum jogo vai ter 5 gols ou mais na fase de grupos da Copa?', 'Festa de gols na primeira fase da Copa do Mundo 2026. Sai um jogo com 5 gols ou mais?', 'esportes', 'active', 20, '2026-06-27 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Algum jogo vai ter 5 gols ou mais na fase de grupos da Copa?' AND concurso_id = concurso_ativo_id);

  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
  SELECT admin_id, 'Neymar vai marcar um gol na fase de grupos da Copa do Mundo?', 'O craque brasileiro na Copa do Mundo 2026. Ele balança a rede na primeira fase?', 'esportes', 'active', 20, '2026-06-27 23:00:00+00', false, concurso_ativo_id
  WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title = 'Neymar vai marcar um gol na fase de grupos da Copa do Mundo?' AND concurso_id = concurso_ativo_id);

END $$;
