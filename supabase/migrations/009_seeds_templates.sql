-- ============================================================
-- 009 — Seeds iniciais + tabela de templates para auto-reposição
-- Cole no SQL Editor: https://supabase.com/dashboard/project/mhckuhqyyfoapzgrqeco/sql/new
-- ============================================================

-- ── Tabela de templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     topic_category NOT NULL,
  is_large     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = grande (min_bet R$20), FALSE = pequeno (min_bet R$1)
  duration_days INT NOT NULL DEFAULT 7,        -- quantos dias até fechar, contado da criação
  used_at      TIMESTAMPTZ,                    -- NULL = disponível para uso
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE topic_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'topic_templates' AND policyname = 'Admin ve templates'
  ) THEN
    CREATE POLICY "Admin ve templates" ON topic_templates FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
  END IF;
END $$;

-- ── 30 eventos iniciais (abril 2026) ────────────────────────────
-- Usa o primeiro admin como creator_id.
-- status = 'active' → já aparecem sem precisar de aprovação.

DO $$ DECLARE admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE is_admin = TRUE LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Nenhum admin encontrado. Crie um usuário admin primeiro.'; END IF;

  -- ═══ GRANDES (min_bet = 20) ═══

  -- Semana 1: fecha 2026-04-05
  INSERT INTO topics (creator_id,title,description,category,status,min_bet,closes_at,is_private)
  VALUES
  (admin_id,'O Palmeiras vai vencer o clássico contra o Corinthians no dia 5 de abril?','Com o Paulistão em fase decisiva, o Verdão enfrenta o Timão em confronto direto pelo título. Quem leva?','esportes','active',20,'2026-04-05 22:00:00+00',false),
  (admin_id,'O dólar vai fechar acima de R$ 6,00 na semana de 31/03 a 04/04?','Com tensão fiscal e cenário externo volátil, o câmbio permanece pressionado. O dólar rompe o piso de R$ 6?','economia','active',20,'2026-04-04 21:00:00+00',false),
  (admin_id,'A Selic vai ser cortada na reunião do Copom de maio de 2026?','O Copom voltou a subir os juros. Há chance de corte antecipado dado o cenário de inflação?','economia','active',20,'2026-04-05 15:00:00+00',false),

  -- Semana 2: fecha 2026-04-12
  (admin_id,'O Brasil vai vencer a próxima rodada das Eliminatórias da Copa do Mundo?','Seleção busca vaga direta no Mundial. A equipe do Dorival consegue os 3 pontos fora de casa?','esportes','active',20,'2026-04-11 22:00:00+00',false),
  (admin_id,'O STF vai pautar e julgar algum processo relacionado a Bolsonaro em abril?','O tribunal tem vários processos em espera. Haverá avanço concreto em ao menos um deles este mês?','politica','active',20,'2026-04-12 18:00:00+00',false),
  (admin_id,'O IBOVESPA vai superar 140.000 pontos até 12 de abril?','Com a bolsa oscilando na faixa de 130k, os touros tentam romper a resistência histórica de 140k.','economia','active',20,'2026-04-12 18:30:00+00',false),

  -- Semana 3: fecha 2026-04-19
  (admin_id,'O governo Lula vai anunciar algum corte de gastos até 19 de abril?','Sob pressão do mercado e do Congresso, o Executivo promete ajuste. Vem algo concreto?','politica','active',20,'2026-04-19 18:00:00+00',false),
  (admin_id,'A Rússia e a Ucrânia vão anunciar algum acordo de cessar-fogo antes do fim de abril de 2026?','Negociações mediadas por potências ocidentais e pela China ganharam novo impulso. Um cessar-fogo formal ou trégua duradoura é anunciado antes de maio?','politica','active',20,'2026-04-18 18:00:00+00',false),
  (admin_id,'A inflação do IPCA de março vai ficar abaixo de 0,5%?','Pressão de alimentos e energia pressionam o índice. O IBGE confirma arrefecimento?','economia','active',20,'2026-04-09 12:00:00+00',false),

  -- Semana 4: fecha 2026-04-26
  (admin_id,'O Bitcoin vai superar US$ 90.000 até o final de abril de 2026?','Após correção, a principal cripto tenta retomar os máximos. Bull run confirmado?','economia','active',20,'2026-04-26 23:59:00+00',false),
  (admin_id,'O Lula vai fazer reforma ministerial até o fim de abril?','Rumores de troca de ministros circulam desde fevereiro. Uma mudança concreta acontece em abril?','politica','active',20,'2026-04-26 18:00:00+00',false),
  (admin_id,'Algum time brasileiro vai se classificar para as oitavas da Libertadores 2026?','Fase de grupos começa quente. Ao menos um clube brasileiro já garante classificação antes da última rodada?','esportes','active',20,'2026-04-25 22:00:00+00',false),

  -- Final de abril: fecha 2026-04-30
  (admin_id,'A Apple vai anunciar novidades de IA no WWDC 2026 que impactem o mercado brasileiro?','A conferência de desenvolvedores da Apple promete. Algum recurso de IA chegará ao Brasil no anúncio?','tecnologia','active',20,'2026-04-30 23:59:00+00',false),
  (admin_id,'Os EUA vão impor novas tarifas sobre exportações brasileiras até o fim de abril de 2026?','A guerra comercial de Trump afeta parceiros globais. O Brasil entra na lista de alvos de tarifas adicionais antes de maio?','politica','active',20,'2026-04-30 23:59:00+00',false),
  (admin_id,'A Netflix vai ter alguma produção brasileira no top 10 global em abril de 2026?','Conteúdo nacional vem performando bem globalmente. Algum título do Brasil domina o ranking?','entretenimento','active',20,'2026-04-30 23:59:00+00',false);

  -- ═══ PEQUENOS (min_bet = 1) ═══

  -- Semana 1: fecha 2026-04-04 / 2026-04-06
  INSERT INTO topics (creator_id,title,description,category,status,min_bet,closes_at,is_private)
  VALUES
  (admin_id,'A China vai anunciar retaliação econômica contra os EUA esta semana?','A guerra tarifária escala. Pequim responde com novas medidas contra produtos ou empresas americanas antes de domingo?','politica','active',1,'2026-04-04 22:00:00+00',false),
  (admin_id,'A Argentina vai anunciar nova medida de controle cambial ou crise econômica esta semana?','O vizinho vive sob pressão permanente. Novo congelamento, default técnico ou turbulência cambial antes de domingo?','economia','active',1,'2026-04-04 18:00:00+00',false),
  (admin_id,'O Banco Central vai intervir no câmbio (leilão de dólares) até 06/04?','Com pressão cambial elevada, o BC pode realizar leilão de dólares no mercado à vista. Uma intervenção formal é publicada antes de domingo?','economia','active',1,'2026-04-05 23:59:00+00',false),
  (admin_id,'O Fed vai sinalizar pausa ou corte de juros nos EUA esta semana?','Com dados de emprego e inflação mistos, o mercado fica atento a qualquer declaração do Fed. Mudança de tom antes de domingo?','economia','active',1,'2026-04-05 12:00:00+00',false),
  (admin_id,'Algum artista brasileiro vai entrar no top 10 do Spotify global esta semana?','O funk e o sertanejo brasileiro têm conquistado o mundo. Quem chega ao topo?','entretenimento','active',1,'2026-04-06 23:59:00+00',false),

  -- Semana 2: fecha 2026-04-11 / 2026-04-13
  (admin_id,'O FMI vai revisar para baixo o crescimento global em 2026 nesta semana?','O Fundo Monetário publica relatório de perspectivas. A guerra comercial força revisão negativa das projeções?','economia','active',1,'2026-04-09 22:00:00+00',false),
  (admin_id,'O preço da gasolina vai subir em pelo menos 3 capitais até 13/04?','Petrobras e distribuidoras ajustam preços com frequência. Novo reajuste em abril?','economia','active',1,'2026-04-11 18:00:00+00',false),
  (admin_id,'Vai ter greve ou paralisação de alguma categoria na semana de 07/04?','Trabalhadores de diversos setores estão em negociação. Alguma categoria cruza os braços?','outros','active',1,'2026-04-11 23:59:00+00',false),
  (admin_id,'Elon Musk vai fazer algum anúncio polêmico sobre o X ou Tesla esta semana?','O bilionário raramente fica em silêncio por mais de 7 dias. O que vem por aí?','tecnologia','active',1,'2026-04-12 23:59:00+00',false),
  (admin_id,'Algum influencer brasileiro com mais de 5M de seguidores vai viralizar negativamente?','O ecossistema de influencers é imprevisível. Mais um vai para as tendências do Twitter?','entretenimento','active',1,'2026-04-13 23:59:00+00',false),

  -- Semana 3: fecha 2026-04-18 / 2026-04-20
  (admin_id,'Haverá escalada militar no conflito do Oriente Médio até 18/04?','Tensões entre Israel, Irã e grupos armados permanecem altas. Um novo ataque ou resposta militar de grande porte ocorre até sexta?','politica','active',1,'2026-04-17 22:00:00+00',false),
  (admin_id,'O preço do petróleo vai cair abaixo de US$ 70 até 18/04?','Tensões geopolíticas vs desaceleração da demanda global. O barril despenca?','economia','active',1,'2026-04-18 18:00:00+00',false),
  (admin_id,'O governo vai anunciar algum benefício social novo até 20/04?','Com eleições de 2026 no horizonte, o governo distribui medidas populares. Vem algo novo?','politica','active',1,'2026-04-20 18:00:00+00',false),
  (admin_id,'Algum reality show brasileiro vai gerar meme viral até 20/04?','BBB, A Fazenda ou outro programa... o Brasil ama um meme de reality. Qual vai bombar?','entretenimento','active',1,'2026-04-19 23:59:00+00',false),

  -- Semana 4: fecha 2026-04-25
  (admin_id,'A Venezuela vai ter nova crise política ou protestos relevantes até 25/04?','O regime Maduro enfrenta pressão interna crescente e isolamento externo. Há manifestações de rua ou ruptura institucional antes do fim do mês?','politica','active',1,'2026-04-25 23:00:00+00',false);

END $$;

-- ── Pool de templates para auto-reposição ───────────────────────
INSERT INTO topic_templates (title, description, category, is_large, duration_days) VALUES

-- GRANDES (is_large = true)
('O Palmeiras vai ganhar o título do Brasileirão?','O Alviverde busca mais um título nacional. As odds indicam favorito, mas o campeonato é longo.','esportes',true,30),
('O Banco Central vai cortar a Selic em mais de 0,25% na próxima reunião?','Com inflação oscilando, o mercado aposta no ritmo do corte. Vem mais de 25 bps?','economia',true,21),
('O governo vai aprovar a reforma tributária integral no Congresso até o fim do mês?','A PEC tramita há meses. Consegue aprovação em dois turnos dentro do prazo?','politica',true,28),
('O Ethereum vai superar US$ 4.000 este mês?','Com a atividade em DeFi e ETFs de ETH em alta, o segundo maior ativo cripto tenta romper resistência. Chega a 4k?','economia',true,30),
('O Brasil vai liderar o ranking da FIFA até o fim deste mês?','A Seleção oscila na tabela. Resultados favoráveis colocam o verde e amarelo no topo?','esportes',true,25),
('O IPCA vai superar a meta do Banco Central este trimestre?','Meta de inflação em xeque. O índice oficial estoura o teto do intervalo?','economia',true,30),
('O STF vai suspender alguma lei aprovada pelo Congresso este mês?','Embate entre poderes é frequente. O Supremo derruba alguma legislação recente?','politica',true,28),
('A Embraer vai anunciar novo contrato milionário no mês?','A fabricante brasileira tem negociações em andamento com várias companhias aéreas.','tecnologia',true,30),
('O Flamengo vai vencer a Libertadores este ano?','Com elenco reforçado, o Mengão é um dos favoritos. Mas a Copa é imprevisível.','esportes',true,21),
('O real vai se valorizar frente ao dólar e fechar abaixo de R$ 5,80 até o fim do mês?','Com fluxo externo positivo, o real pode surpreender e romper suporte para baixo.','economia',true,25),
('O governo vai anunciar privatização de alguma estatal este mês?','Agenda de privatizações segue em discussão. Algum ativo vai a leilão antes do prazo?','politica',true,28),
('O Corinthians vai vencer o Derby paulista este mês?','O clássico mais disputado do Brasil. O Timão consegue superar o rival no momento atual?','esportes',true,21),
('A Petrobras vai anunciar aumento de dividendos acima do esperado?','A estatal tem distribuído dividendos recordes. O mercado aguarda novo anúncio extraordinário.','economia',true,25),
('A SpaceX vai realizar um lançamento bem-sucedido este mês?','Starship e Falcon 9 têm cronogramas apertados. Ao menos um lançamento com sucesso?','tecnologia',true,20),
('O Brasil vai assinar acordo comercial bilateral relevante com algum país este mês?','Diplomacia econômica ativa. Um acordo inédito ou renovação de tratado de impacto é formalizado?','politica',true,28),
('Os EUA vão entrar em recessão técnica neste trimestre?','Dois trimestres consecutivos de PIB negativo configuram recessão. Com tarifa e juros altos, os dados do Fed confirmam contração?','economia',true,30),
('O ouro vai superar US$ 3.000 por onça este mês?','Com instabilidade global, o metal precioso é refúgio. Rompe a máxima histórica?','economia',true,25),
('A OpenAI vai lançar novo modelo GPT com capacidades superiores ao atual?','A empresa acelera lançamentos. Um novo modelo maior ou mais eficiente chega ao mercado?','tecnologia',true,28),
('O Brasil vai sofrer rebaixamento de rating por agência internacional este trimestre?','Fitch, Moody ou S&P revisam o risco soberano do Brasil. Um downgrade acontece antes do fim do trimestre?','economia',true,30),
('Haverá nova crise bancária global neste trimestre?','Com juros altos e tensões comerciais, bancos regionais americanos e europeus estão sob pressão. Um colapso sistêmico acontece antes do fim do trimestre?','economia',true,30),

-- PEQUENOS (is_large = false)
('Os EUA vão anunciar novas sanções contra a Rússia esta semana?','O pacote de sanções americanas é renovado periodicamente. Novas medidas atingindo setores energéticos ou financeiros russos saem antes de domingo?','politica',false,7),
('O peso argentino vai desvalorizar mais de 3% frente ao dólar esta semana?','A Argentina vive sob pressão cambial crônica. Nova desvalorização expressiva acontece antes de domingo?','economia',false,7),
('Algum ministro do governo vai pedir demissão esta semana?','Tensões internas no governo são frequentes. Uma saída surpresa acontece antes de domingo?','politica',false,7),
('A Meta vai anunciar novo recurso de IA para o WhatsApp esta semana?','A empresa investe pesado em IA. Novidade para o app mais usado no Brasil?','tecnologia',false,7),
('Alguma música brasileira vai entrar no top 3 do Spotify Brasil esta semana?','Funk, pagode ou sertanejo? Qual gênero domina o ranking semanal?','entretenimento',false,7),
('O Internacional vai vencer o Grenal desta semana?','O clássico gaúcho é sempre imprevisível. O Colorado leva a melhor dessa vez?','esportes',false,7),
('O preço do café vai subir mais de 2% esta semana?','Brasil é maior produtor mundial. Clima e dólar afetam o preço do grão.','economia',false,7),
('O governo federal vai publicar Medida Provisória esta semana?','MPs são publicadas no Diário Oficial e têm efeito imediato. O Executivo usa esse instrumento antes de domingo?','politica',false,7),
('Haverá vazamento de dados de grande empresa de tecnologia esta semana?','Ataques a bancos de dados corporativos são cada vez mais frequentes. Uma brecha de grande repercussão vem a público esta semana?','tecnologia',false,7),
('O IBGE vai divulgar dado econômico abaixo da expectativa do mercado esta semana?','IPCA, PNAD, PIB ou produção industrial saem periodicamente. Algum número decepciona o consenso antes de domingo?','economia',false,7),
('A China vai fazer movimentação militar relevante no Mar do Sul da China esta semana?','Tensões com Filipinas, Taiwan e EUA persistem. Exercícios navais ou incidente aéreo de grande repercussão ocorre esta semana?','politica',false,7),
('A bolsa brasileira vai subir mais de 1% esta semana?','Com fluxo gringo e dados positivos, o Ibovespa tenta superar resistências.','economia',false,7),
('O presidente vai fazer pronunciamento à nação esta semana?','Uso da cadeia nacional em momentos de crise ou anúncio importante. Vem aí?','politica',false,7),
('A NASA vai anunciar nova descoberta científica relevante esta semana?','Missões ativas como Artemis, James Webb e Mars Reconnaissance produzem dados constantemente. Uma descoberta de impacto vem a público?','tecnologia',false,7),
('Algum BBB vai se tornar meme viral esta semana?','O Big Brother Brasil gera conteúdo diariamente. Um momento vai explodir nas redes?','entretenimento',false,7),
('A OTAN vai anunciar expansão de tropas ou equipamentos na Europa Oriental esta semana?','Com a guerra na Ucrânia, aliados ocidentais reforçam presença no leste europeu continuamente. Novo anúncio formal de reforço esta semana?','politica',false,7),
('O IBOVESPA vai fechar em alta na sexta-feira?','Mercado de fechamento de semana é influenciado por dados do exterior e fluxo local.','economia',false,5),
('O STF vai pautar julgamento de repercussão geral esta semana?','O Supremo tem pauta com dezenas de temas pendentes. Um caso de repercussão geral com impacto nacional entra em julgamento antes de domingo?','politica',false,7),
('Haverá novo ataque cibernético de grande escala a infraestrutura crítica esta semana?','Redes elétricas, bancos e governos são alvos recorrentes. Um ataque de grande repercussão é noticiado esta semana?','tecnologia',false,7),
('Alguma produção brasileira vai ganhar prêmio em festival internacional esta semana?','Cinema, música e séries brasileiras disputam prêmios globais regularmente. Uma vitória oficial é anunciada antes de domingo?','entretenimento',false,7);
