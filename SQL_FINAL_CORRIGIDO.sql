-- ============================================================
-- EVENTOS PARA ZAFE - SEGUINDO CLALDE.MD EXATAMENTE
-- URL: https://supabase.com/dashboard/project/mhckuhqyyfoapzgrqeco/sql/new
-- ============================================================

DO $$
DECLARE 
  admin_id UUID;
  concurso_ativo_id UUID;
BEGIN
  -- Buscar admin
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado!'; END IF;
  
  RAISE NOTICE 'Admin ID: %', admin_id;
  
  -- Garantir que coluna concurso_id existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='topics' AND column_name='concurso_id') THEN
    ALTER TABLE topics ADD COLUMN concurso_id UUID;
    CREATE INDEX idx_topics_concurso_id ON topics(concurso_id);
    RAISE NOTICE 'Coluna concurso_id adicionada!';
  END IF;
  
  -- Buscar concurso ativo
  SELECT id INTO concurso_ativo_id FROM concursos WHERE status = 'ativo' LIMIT 1;
  RAISE NOTICE 'Concurso Ativo ID: %', concurso_ativo_id;
  
  -- ============================================================
  -- ZAFE ECONÔMICO (APENAS ADMIN CRIA) - 5 EVENTOS
  -- Estes NÃO vão para a Liga! (conforme CLAUDE.md)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private)
  VALUES
    (admin_id, 'O IPCA de abril vai ficar abaixo de 0,3%?', 'Inflação desacelera com queda em alimentos. IBGE surpreende positivamente?', 'economia', 'active', 1, '2026-05-11 09:00:00+00', false),
    (admin_id, 'O dólar vai fechar abaixo de R$ 5,70 em maio?', 'Cenário externo favorável e fluxo de capital estrangeiro pressionam o câmbio para baixo.', 'economia', 'active', 1, '2026-05-30 18:00:00+00', false),
    (admin_id, 'O Ibovespa vai superar 145.000 pontos em maio?', 'Bolsa brasileira testa novo patamar com otimismo global e resultados trimestrais.', 'economia', 'active', 1, '2026-05-25 18:00:00+00', false),
    (admin_id, 'A Petrobras vai anunciar novo aumento de combustíveis?', 'Pressão do mercado internacional e câmbio forçam a estatal a rever preços.', 'economia', 'active', 1, '2026-05-14 12:00:00+00', false),
    (admin_id, 'O Bitcoin vai atingir US$ 95.000 até o fim de maio?', 'Criptoativo ganha tração com expectativa de cortes de juros nos EUA.', 'economia', 'active', 1, '2026-05-31 23:59:00+00', false)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Eventos do Zafe Econômico inseridos (5 eventos)!';
  
  -- ============================================================
  -- LIGA (eventos NÃO-economia) - 15 EVENTOS
  -- "A Liga é para qualquer coisa que NÃO é categoria economia" (CLAUDE.md)
  -- ============================================================
  INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private)
  VALUES
    -- ESPORTES (5)
    (admin_id, 'O São Paulo vai vencer o clássico contra o Santos no Morumbi?', 'O Majestoso promete! O Tricolor joga em casa e busca a vitória.', 'esportes', 'active', 1, '2026-05-10 22:00:00+00', false),
    (admin_id, 'O Real Madrid vai eliminar o Manchester City na Champions?', 'Duelo de gigantes nas quartas de final da Champions League.', 'esportes', 'active', 1, '2026-05-12 23:30:00+00', false),
    (admin_id, 'O Corinthians vai se classificar para as oitavas da Libertadores?', 'Timão precisa de resultado positivo fora de casa para garantir vaga antecipada.', 'esportes', 'active', 1, '2026-05-15 22:00:00+00', false),
    (admin_id, 'A Fórmula 1 terá novo vencedor no GP de Miami?', 'GP de Miami promete disputa acirrada entre Verstappen, Leclerc e outros.', 'esportes', 'active', 1, '2026-05-08 20:00:00+00', false),
    (admin_id, 'O Flamengo vai golear o Vasco no clássico?', 'Fla-Flu e Flamengo x Vasco movimentam o Rio. Mengão é favorito?', 'esportes', 'active', 1, '2026-05-18 21:00:00+00', false),
    
    -- POLÍTICA (5)
    (admin_id, 'O STF vai julgar e derrubar a taxação de fortunas em maio?', 'Tema polêmico tramita no Supremo. A Corte valida ou derruba a proposta?', 'politica', 'active', 1, '2026-05-20 18:00:00+00', false),
    (admin_id, 'O Congresso vai aprovar a reforma tributária até o recesso?', 'Prazo apertado para votar os detalhes da PEC antes do recesso parlamentar.', 'politica', 'active', 1, '2026-05-28 18:00:00+00', false),
    (admin_id, 'O governo vai anunciar novo pacote de estímulo fiscal?', 'Com economia morna, Executivo prepara medidas para aquecer o consumo.', 'politica', 'active', 1, '2026-05-16 15:00:00+00', false),
    (admin_id, 'O TSE vai aprovar novas regras para as eleições de 2026?', 'Tribunal Superior Eleitoral discute mudanças no calendário e no fundo eleitoral.', 'politica', 'active', 1, '2026-05-22 18:00:00+00', false),
    (admin_id, 'Impeachment de Trump avança no Congresso americano?', 'Processo político ganha tração com novas evidências. Câmara aprova prosseguimento?', 'politica', 'active', 1, '2026-05-14 18:00:00+00', false),
    
    -- TECNOLOGIA (3)
    (admin_id, 'A Apple vai lançar o iPhone 17 com tela dobrável?', 'Rumores indicam que a Maçã pode surpreender com novo design revolucionário.', 'tecnologia', 'active', 1, '2026-05-30 23:59:00+00', false),
    (admin_id, 'O ChatGPT vai atingir 500 milhões de usuários ativos?', 'OpenAI cresce acelerado. O marco de meio bilhão vem em maio?', 'tecnologia', 'active', 1, '2026-05-25 12:00:00+00', false),
    (admin_id, 'O Brasil vai lançar satélite próprio de internet 6G?', 'Projeto nacional avança com parcerias internacionais. Lançamento acontece este mês?', 'tecnologia', 'active', 1, '2026-05-18 10:00:00+00', false),
    
    -- ENTRETENIMENTO (2)
    (admin_id, 'O BBB 26 vai ter novo líder com mais de 80% dos votos?', 'Votação em pauta promete divisão na casa. Líder ganha apoio massivo?', 'entretenimento', 'active', 1, '2026-05-09 22:00:00+00', false),
    (admin_id, 'Algum filme brasileiro vai bater 1 milhão de views no streaming este mês?', 'Produções nacionais ganham espaço global. Recorde de audiência em maio?', 'entretenimento', 'active', 1, '2026-05-28 23:59:00+00', false)
    
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Eventos da Liga inseridos (15 eventos - sem economia)!';
  
  -- ============================================================
  -- CONCURSO (com concurso_id, min_bet=20) - 19 EVENTOS
  -- Inclui eventos de economia também (CLAUDE.md: "Universo de eventos é qualquer coisa")
  -- ============================================================
  IF concurso_ativo_id IS NOT NULL THEN
    INSERT INTO topics (creator_id, title, description, category, status, min_bet, closes_at, is_private, concurso_id)
    VALUES
      -- ESPORTES (4)
      (admin_id, 'O Palmeiras vai golear o São Paulo no Morumbi?', 'Choque-rei com Verdão favorito mesmo fora de casa. Goleada é possível?', 'esportes', 'active', 20, '2026-05-10 22:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O Brasil vai golear a Venezuela nas Eliminatórias?', 'Seleção busca recuperação na tabela. Vitória elástica em casa?', 'esportes', 'active', 20, '2026-05-13 22:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O PSG vai eliminar o Bayern na Champions League?', 'Duelo europeu decisivo. Time francês surpreende os alemães?', 'esportes', 'active', 20, '2026-05-15 23:30:00+00', false, concurso_ativo_id),
      (admin_id, 'O Nadal vai ganhar seu 15º Roland Garros?', 'Lenda do tênis tenta mais um título em Paris. Aposentadoria próxima ou novo triunfo?', 'esportes', 'active', 20, '2026-05-25 18:00:00+00', false, concurso_ativo_id),
      
      -- ECONOMIA (4) - Agora NO Concurso também!
      (admin_id, 'O Copom vai cortar a Selic em 0,50% em maio?', 'Mercado aposta em aceleração do ciclo de cortes com inflação sob controle.', 'economia', 'active', 20, '2026-05-07 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O euro vai superar o dólar em paridade até maio?', 'Moeda europeia ganha força com estabilidade política. Paridade histórica?', 'economia', 'active', 20, '2026-05-20 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'A China vai crescer mais de 5% no segundo trimestre?', 'Dados econômicos chineses surpreendem positivamente. Meta do governo é atingida?', 'economia', 'active', 20, '2026-05-28 23:59:00+00', false, concurso_ativo_id),
      (admin_id, 'O Ethereum vai superar US$ 5.000 em maio?', 'Criptoativo lidera ganhos com upgrade de rede. Rally impressiona investidores?', 'economia', 'active', 20, '2026-05-30 23:59:00+00', false, concurso_ativo_id),
      
      -- POLÍTICA (4)
      (admin_id, 'A ONU vai intervir militarmente na crise do Saara?', 'Conflitos no norte da África escalam. Missão de paz com mandato amplo é aprovada?', 'politica', 'active', 20, '2026-05-22 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O governo Lula vai aprovar a reforma da Previdência?', 'Nova reforma é prioridade do Executivo. Congresso aprova em primeiro turno?', 'politica', 'active', 20, '2026-05-26 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O governo vai aprovar nova lei de imigração em maio?', 'Novo marco legal para imigrantes tramita no Congresso. Aprovação em plenário?', 'politica', 'active', 20, '2026-05-24 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O STF vai derrubar a taxação de fortunas?', 'Tema polêmico no Supremo. Corte derruba a proposta de taxação?', 'politica', 'active', 20, '2026-05-20 18:00:00+00', false, concurso_ativo_id),
      
      -- TECNOLOGIA (4)
      (admin_id, 'A Tesla vai lançar carro autônomo nível 5 em maio?', 'Musk promete revolução. Tecnologia plena é liberada para uso público?', 'tecnologia', 'active', 20, '2026-05-18 12:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O Google vai superar a OpenAI em participação de mercado de IA?', 'Nova estratégia do Google com Gemini ganha tração. O gigante retoma liderança?', 'tecnologia', 'active', 20, '2026-05-24 12:00:00+00', false, concurso_ativo_id),
      (admin_id, 'A Apple vai lançar iPhone 17 dobrável?', 'Rumores indicam novo design revolucionário da Maçã em maio.', 'tecnologia', 'active', 20, '2026-05-30 23:59:00+00', false, concurso_ativo_id),
      (admin_id, 'O ChatGPT vai atingir 500 milhões de usuários?', 'OpenAI cresce acelerado. Marco de meio bilhão em maio?', 'tecnologia', 'active', 20, '2026-05-25 12:00:00+00', false, concurso_ativo_id),
      
      -- ENTRETENIMENTO (3)
      (admin_id, 'O Oscar 2026 terá filme brasileiro indicado?', 'Cinema nacional forte na temporada. Indicação inédita para o Brasil?', 'entretenimento', 'active', 20, '2026-05-28 23:59:00+00', false, concurso_ativo_id),
      (admin_id, 'A Taylor Swift vai anunciar nova turnê mundial em maio?', 'Fãs aguardam ansiosos. Anúncio surpresa vem antes do verão americano?', 'entretenimento', 'active', 20, '2026-05-16 18:00:00+00', false, concurso_ativo_id),
      (admin_id, 'O BBB 26 vai ter líder com mais de 80% dos votos?', 'Votação em pauta na casa. Líder ganha apoio massivo?', 'entretenimento', 'active', 20, '2026-05-09 22:00:00+00', false, concurso_ativo_id)
    
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Eventos do Concurso inseridos (19 eventos, incluindo economia)!';
  ELSE
    RAISE NOTICE 'Nenhum concurso ativo encontrado. Eventos do Concurso NÃO foram inseridos.';
  END IF;
  
  -- ============================================================
  -- LIMPAR EVENTOS ANTIGOS COM "TESTE" NO NOME
  -- ============================================================
  DELETE FROM topics WHERE title LIKE '%Teste:%' OR title LIKE 'Teste:%';
  RAISE NOTICE 'Eventos de teste removidos!';
  
END $$;

-- ============================================================
-- VERIFICAR RESULTADO FINAL
-- ============================================================
SELECT 
  CASE 
    WHEN category = 'economia' AND concurso_id IS NULL THEN 'ECONÔMICO'
    WHEN concurso_id IS NULL THEN 'LIGA' 
    ELSE 'CONCURSO' 
  END AS pilar,
  COUNT(*) AS total_eventos,
  COUNT(*) FILTER (WHERE status = 'active') AS ativos
FROM topics
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY 
  CASE 
    WHEN category = 'economia' AND concurso_id IS NULL THEN 'ECONÔMICO'
    WHEN concurso_id IS NULL THEN 'LIGA' 
    ELSE 'CONCURSO' 
  END;

-- VER TODOS OS EVENTOS ATIVOS (para debug)
SELECT 
  id,
  title,
  category,
  status,
  closes_at,
  CASE 
    WHEN category = 'economia' AND concurso_id IS NULL THEN 'ECONÔMICO'
    WHEN concurso_id IS NULL THEN 'LIGA'
    ELSE 'CONCURSO' 
  END AS pilar
FROM topics
WHERE status = 'active'
ORDER BY closes_at
LIMIT 50;
