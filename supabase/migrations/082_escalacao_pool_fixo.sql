-- ── Pools dos quatro cards de fixo + abertura ────────────────────────────────
--
-- Os cards de fixo nasceram em rascunho na 081 e a policy `escalacao_card_select`
-- esconde rascunho de `authenticated`. Resultado: /escalacao só devolvia o mix e o
-- seletor de Convocação (que só aparece com mais de um card) nunca renderizava.
-- Publicar exige pool >= n_titulares, então o pool vem junto.
--
-- Datas: cada Convocação do fixo **fecha às 9h de Brasília do 1º dia do mês que
-- ela apura**. É a mesma regra do `closes_at` de `docs/CRIAR-EVENTO.md` levada ao
-- limite conservador — fechando antes de o mês começar, nenhum atleta pode ser
-- escalado por quem já viu o resultado, sem depender de eu acertar o calendário
-- de quatro ligas. `abre_em` recua para agora para os cards já valerem hoje.
--
-- A NBA sai de setembro: a temporada 2026-27 só começa no fim de outubro, e um
-- card de setembro não teria um único jogo para apurar.
--
-- O pool é a curadoria inicial (elenco por posição e clube, vocabulário da
-- formação — ver `docs/ESCALACAO-APURACAO.md`). Reimportar pelo painel é
-- idempotente e continua sendo o caminho normal de manutenção; aqui ele entra em
-- SQL só porque publicar depende dele.

-- ── 1. Datas e mês ───────────────────────────────────────────────────────────
-- Ainda em rascunho, então o T6 deixa mexer.

UPDATE escalacao_card SET
  abre_em  = TIMESTAMPTZ '2026-08-09 09:00-03',
  fecha_em = TIMESTAMPTZ '2026-09-01 09:00-03'
 WHERE modo = 'fixo' AND status = 'rascunho' AND mes = DATE '2026-09-01'
   AND competicao_id IN (SELECT id FROM escalacao_competicao WHERE slug IN ('brasileirao','nfl','vct'));

UPDATE escalacao_card SET
  titulo   = 'NBA — Outubro/2026',
  mes      = DATE '2026-10-01',
  abre_em  = TIMESTAMPTZ '2026-08-09 09:00-03',
  fecha_em = TIMESTAMPTZ '2026-10-01 09:00-03'
 WHERE modo = 'fixo' AND status = 'rascunho'
   AND competicao_id = (SELECT id FROM escalacao_competicao WHERE slug = 'nba');

-- ── 2. Pool ──────────────────────────────────────────────────────────────────
-- `slug` reproduz `slugificar()` do importador (`app/api/admin/escalacao/[id]/pool`):
-- NFD, tira as combinantes, minúsculas, não-alfanumérico vira hífen. É o que torna
-- reimportar pelo painel idempotente em cima destas linhas.

CREATE TEMP TABLE _pool (esporte TEXT, comp TEXT, nome TEXT, clube TEXT, posicao TEXT);

INSERT INTO _pool VALUES
  -- Brasileirão — 12 clubes × 5 (um por posição da formação 4-3-3)
  ('futebol','brasileirao','Agustín Rossi','Flamengo','GOL'),
  ('futebol','brasileirao','Guillermo Varela','Flamengo','LAT'),
  ('futebol','brasileirao','Léo Ortiz','Flamengo','ZAG'),
  ('futebol','brasileirao','Giorgian de Arrascaeta','Flamengo','MEI'),
  ('futebol','brasileirao','Pedro','Flamengo','ATA'),
  ('futebol','brasileirao','Weverton','Palmeiras','GOL'),
  ('futebol','brasileirao','Joaquín Piquerez','Palmeiras','LAT'),
  ('futebol','brasileirao','Gustavo Gómez','Palmeiras','ZAG'),
  ('futebol','brasileirao','Raphael Veiga','Palmeiras','MEI'),
  ('futebol','brasileirao','Vitor Roque','Palmeiras','ATA'),
  ('futebol','brasileirao','Hugo Souza','Corinthians','GOL'),
  ('futebol','brasileirao','Matheuzinho','Corinthians','LAT'),
  ('futebol','brasileirao','Cacá','Corinthians','ZAG'),
  ('futebol','brasileirao','Rodrigo Garro','Corinthians','MEI'),
  ('futebol','brasileirao','Yuri Alberto','Corinthians','ATA'),
  ('futebol','brasileirao','Rafael','São Paulo','GOL'),
  ('futebol','brasileirao','Wendell','São Paulo','LAT'),
  ('futebol','brasileirao','Robert Arboleda','São Paulo','ZAG'),
  ('futebol','brasileirao','Oscar','São Paulo','MEI'),
  ('futebol','brasileirao','Lucas Moura','São Paulo','ATA'),
  ('futebol','brasileirao','Fábio','Fluminense','GOL'),
  ('futebol','brasileirao','Samuel Xavier','Fluminense','LAT'),
  ('futebol','brasileirao','Thiago Silva','Fluminense','ZAG'),
  ('futebol','brasileirao','Paulo Henrique Ganso','Fluminense','MEI'),
  ('futebol','brasileirao','Germán Cano','Fluminense','ATA'),
  ('futebol','brasileirao','Neto','Botafogo','GOL'),
  ('futebol','brasileirao','Alex Telles','Botafogo','LAT'),
  ('futebol','brasileirao','Alexander Barboza','Botafogo','ZAG'),
  ('futebol','brasileirao','Gregore','Botafogo','MEI'),
  ('futebol','brasileirao','Artur','Botafogo','ATA'),
  ('futebol','brasileirao','Cássio','Cruzeiro','GOL'),
  ('futebol','brasileirao','William','Cruzeiro','LAT'),
  ('futebol','brasileirao','Fabrício Bruno','Cruzeiro','ZAG'),
  ('futebol','brasileirao','Matheus Pereira','Cruzeiro','MEI'),
  ('futebol','brasileirao','Kaio Jorge','Cruzeiro','ATA'),
  ('futebol','brasileirao','Everson','Atlético-MG','GOL'),
  ('futebol','brasileirao','Guilherme Arana','Atlético-MG','LAT'),
  ('futebol','brasileirao','Lyanco','Atlético-MG','ZAG'),
  ('futebol','brasileirao','Bernard','Atlético-MG','MEI'),
  ('futebol','brasileirao','Hulk','Atlético-MG','ATA'),
  ('futebol','brasileirao','Sergio Rochet','Internacional','GOL'),
  ('futebol','brasileirao','Bernabei','Internacional','LAT'),
  ('futebol','brasileirao','Vitão','Internacional','ZAG'),
  ('futebol','brasileirao','Alan Patrick','Internacional','MEI'),
  ('futebol','brasileirao','Rafael Borré','Internacional','ATA'),
  ('futebol','brasileirao','Tiago Volpi','Grêmio','GOL'),
  ('futebol','brasileirao','Marlon','Grêmio','LAT'),
  ('futebol','brasileirao','Walter Kannemann','Grêmio','ZAG'),
  ('futebol','brasileirao','Franco Cristaldo','Grêmio','MEI'),
  ('futebol','brasileirao','Martin Braithwaite','Grêmio','ATA'),
  ('futebol','brasileirao','Marcos Felipe','Bahia','GOL'),
  ('futebol','brasileirao','Gilberto','Bahia','LAT'),
  ('futebol','brasileirao','Kanu','Bahia','ZAG'),
  ('futebol','brasileirao','Everton Ribeiro','Bahia','MEI'),
  ('futebol','brasileirao','Everaldo','Bahia','ATA'),
  ('futebol','brasileirao','Léo Jardim','Vasco','GOL'),
  ('futebol','brasileirao','Paulo Henrique','Vasco','LAT'),
  ('futebol','brasileirao','Lucas Oliveira','Vasco','ZAG'),
  ('futebol','brasileirao','Philippe Coutinho','Vasco','MEI'),
  ('futebol','brasileirao','Pablo Vegetti','Vasco','ATA'),

  -- NBA — 15 franquias × 2 (o teto por franquia é 2)
  ('nba','nba','Luka Doncic','Los Angeles Lakers','ARM'),
  ('nba','nba','LeBron James','Los Angeles Lakers','ALA'),
  ('nba','nba','Jayson Tatum','Boston Celtics','ALA'),
  ('nba','nba','Derrick White','Boston Celtics','ARM'),
  ('nba','nba','Nikola Jokic','Denver Nuggets','PIVO'),
  ('nba','nba','Jamal Murray','Denver Nuggets','ARM'),
  ('nba','nba','Shai Gilgeous-Alexander','Oklahoma City Thunder','ARM'),
  ('nba','nba','Chet Holmgren','Oklahoma City Thunder','PIVO'),
  ('nba','nba','Giannis Antetokounmpo','Milwaukee Bucks','ALA-PIVO'),
  ('nba','nba','Myles Turner','Milwaukee Bucks','PIVO'),
  ('nba','nba','Anthony Davis','Dallas Mavericks','ALA-PIVO'),
  ('nba','nba','Kyrie Irving','Dallas Mavericks','ARM'),
  ('nba','nba','Stephen Curry','Golden State Warriors','ARM'),
  ('nba','nba','Jimmy Butler','Golden State Warriors','ALA'),
  ('nba','nba','Joel Embiid','Philadelphia 76ers','PIVO'),
  ('nba','nba','Tyrese Maxey','Philadelphia 76ers','ARM'),
  ('nba','nba','Devin Booker','Phoenix Suns','ALA-ARM'),
  ('nba','nba','Jalen Green','Phoenix Suns','ALA-ARM'),
  ('nba','nba','Jalen Brunson','New York Knicks','ARM'),
  ('nba','nba','Karl-Anthony Towns','New York Knicks','PIVO'),
  ('nba','nba','Anthony Edwards','Minnesota Timberwolves','ALA-ARM'),
  ('nba','nba','Rudy Gobert','Minnesota Timberwolves','PIVO'),
  ('nba','nba','Donovan Mitchell','Cleveland Cavaliers','ALA-ARM'),
  ('nba','nba','Evan Mobley','Cleveland Cavaliers','ALA-PIVO'),
  ('nba','nba','Kevin Durant','Houston Rockets','ALA'),
  ('nba','nba','Alperen Sengun','Houston Rockets','PIVO'),
  ('nba','nba','Victor Wembanyama','San Antonio Spurs','PIVO'),
  ('nba','nba','Stephon Castle','San Antonio Spurs','ARM'),
  ('nba','nba','Ja Morant','Memphis Grizzlies','ARM'),
  ('nba','nba','Jaren Jackson Jr','Memphis Grizzlies','ALA-PIVO'),

  -- NFL — QB/RB/WR/TE/K + defesas de franquia (o teto por franquia é 2)
  ('nfl','nfl','Patrick Mahomes','Kansas City Chiefs','QB'),
  ('nfl','nfl','Josh Allen','Buffalo Bills','QB'),
  ('nfl','nfl','Lamar Jackson','Baltimore Ravens','QB'),
  ('nfl','nfl','Joe Burrow','Cincinnati Bengals','QB'),
  ('nfl','nfl','Jalen Hurts','Philadelphia Eagles','QB'),
  ('nfl','nfl','C.J. Stroud','Houston Texans','QB'),
  ('nfl','nfl','Jayden Daniels','Washington Commanders','QB'),
  ('nfl','nfl','Justin Herbert','Los Angeles Chargers','QB'),
  ('nfl','nfl','Saquon Barkley','Philadelphia Eagles','RB'),
  ('nfl','nfl','Derrick Henry','Baltimore Ravens','RB'),
  ('nfl','nfl','Bijan Robinson','Atlanta Falcons','RB'),
  ('nfl','nfl','Jahmyr Gibbs','Detroit Lions','RB'),
  ('nfl','nfl','Christian McCaffrey','San Francisco 49ers','RB'),
  ('nfl','nfl','Josh Jacobs','Green Bay Packers','RB'),
  ('nfl','nfl','De''Von Achane','Miami Dolphins','RB'),
  ('nfl','nfl','Ashton Jeanty','Las Vegas Raiders','RB'),
  ('nfl','nfl','Ja''Marr Chase','Cincinnati Bengals','WR'),
  ('nfl','nfl','Justin Jefferson','Minnesota Vikings','WR'),
  ('nfl','nfl','CeeDee Lamb','Dallas Cowboys','WR'),
  ('nfl','nfl','Amon-Ra St. Brown','Detroit Lions','WR'),
  ('nfl','nfl','Puka Nacua','Los Angeles Rams','WR'),
  ('nfl','nfl','Malik Nabers','New York Giants','WR'),
  ('nfl','nfl','Nico Collins','Houston Texans','WR'),
  ('nfl','nfl','Brian Thomas Jr.','Jacksonville Jaguars','WR'),
  ('nfl','nfl','Garrett Wilson','New York Jets','WR'),
  ('nfl','nfl','Travis Kelce','Kansas City Chiefs','TE'),
  ('nfl','nfl','Brock Bowers','Las Vegas Raiders','TE'),
  ('nfl','nfl','George Kittle','San Francisco 49ers','TE'),
  ('nfl','nfl','Trey McBride','Arizona Cardinals','TE'),
  ('nfl','nfl','Sam LaPorta','Detroit Lions','TE'),
  ('nfl','nfl','Mark Andrews','Baltimore Ravens','TE'),
  ('nfl','nfl','Brandon Aubrey','Dallas Cowboys','K'),
  ('nfl','nfl','Cameron Dicker','Los Angeles Chargers','K'),
  ('nfl','nfl','Chris Boswell','Pittsburgh Steelers','K'),
  ('nfl','nfl','Ka''imi Fairbairn','Houston Texans','K'),
  ('nfl','nfl','Jake Bates','Detroit Lions','K'),
  ('nfl','nfl','Defesa do Pittsburgh Steelers','Pittsburgh Steelers','DEF'),
  ('nfl','nfl','Defesa do Baltimore Ravens','Baltimore Ravens','DEF'),
  ('nfl','nfl','Defesa do Denver Broncos','Denver Broncos','DEF'),
  ('nfl','nfl','Defesa do Philadelphia Eagles','Philadelphia Eagles','DEF'),
  ('nfl','nfl','Defesa do Minnesota Vikings','Minnesota Vikings','DEF'),
  ('nfl','nfl','Defesa do Houston Texans','Houston Texans','DEF'),

  -- Valorant — VCT Americas (o teto por organização é 2)
  ('valorant','vct','qck','LOUD','DUELISTA'),
  ('valorant','vct','saadhak','LOUD','INICIADOR'),
  ('valorant','vct','cauanzin','LOUD','SENTINELA'),
  ('valorant','vct','tuyz','LOUD','CONTROLADOR'),
  ('valorant','vct','aspas','MIBR','DUELISTA'),
  ('valorant','vct','havoc','MIBR','INICIADOR'),
  ('valorant','vct','artzin','MIBR','DUELISTA'),
  ('valorant','vct','cortezia','MIBR','CONTROLADOR'),
  ('valorant','vct','mwzera','FURIA','DUELISTA'),
  ('valorant','vct','khalil','FURIA','INICIADOR'),
  ('valorant','vct','raafa','FURIA','SENTINELA'),
  ('valorant','vct','heat','FURIA','CONTROLADOR'),
  ('valorant','vct','zekken','Sentinels','DUELISTA'),
  ('valorant','vct','johnqt','Sentinels','INICIADOR'),
  ('valorant','vct','Sacy','Sentinels','INICIADOR'),
  ('valorant','vct','zellsis','Sentinels','CONTROLADOR'),
  ('valorant','vct','Verno','NRG','DUELISTA'),
  ('valorant','vct','Ethan','NRG','INICIADOR'),
  ('valorant','vct','crashies','NRG','INICIADOR'),
  ('valorant','vct','s0m','NRG','CONTROLADOR'),
  ('valorant','vct','Cryocells','100 Thieves','DUELISTA'),
  ('valorant','vct','Boostio','100 Thieves','SENTINELA'),
  ('valorant','vct','eeiu','100 Thieves','INICIADOR'),
  ('valorant','vct','Tex','Leviatán','DUELISTA'),
  ('valorant','vct','kiNgg','Leviatán','INICIADOR'),
  ('valorant','vct','Mazino','Leviatán','SENTINELA'),
  ('valorant','vct','C0M','Leviatán','CONTROLADOR'),
  ('valorant','vct','trent','G2 Esports','DUELISTA'),
  ('valorant','vct','valyn','G2 Esports','INICIADOR'),
  ('valorant','vct','leaf','G2 Esports','SENTINELA'),
  ('valorant','vct','JonahP','G2 Esports','DUELISTA'),
  ('valorant','vct','OXY','Cloud9','DUELISTA'),
  ('valorant','vct','moose','Cloud9','INICIADOR'),
  ('valorant','vct','runi','Cloud9','SENTINELA'),
  ('valorant','vct','vanity','Cloud9','CONTROLADOR'),
  ('valorant','vct','keznit','KRÜ Esports','DUELISTA'),
  ('valorant','vct','NagZ','KRÜ Esports','INICIADOR'),
  ('valorant','vct','Shyy','KRÜ Esports','SENTINELA'),
  ('valorant','vct','Melser','KRÜ Esports','CONTROLADOR');

INSERT INTO escalacao_atleta (nome, slug, esporte_key, competicao_id, genero, clube, posicao)
SELECT p.nome,
       p.esporte || '-' || regexp_replace(
         regexp_replace(
           lower(regexp_replace(normalize(p.nome, NFD), '[^[:ascii:]]', '', 'g')),
           '[^a-z0-9]+', '-', 'g'),
         '(^-|-$)', '', 'g'),
       p.esporte, co.id, 'misto', p.clube, p.posicao
  FROM _pool p
  JOIN escalacao_competicao co ON co.slug = p.comp
ON CONFLICT (slug) DO UPDATE
  SET clube = EXCLUDED.clube, posicao = EXCLUDED.posicao, competicao_id = EXCLUDED.competicao_id;

INSERT INTO escalacao_card_atleta (card_id, atleta_id, esporte_key, regra_id)
SELECT ce.card_id, a.id, ce.esporte_key, ce.regra_id
  FROM escalacao_card c
  JOIN escalacao_card_esporte ce ON ce.card_id = c.id
  JOIN escalacao_atleta a ON a.esporte_key = ce.esporte_key AND a.competicao_id = c.competicao_id
 WHERE c.modo = 'fixo' AND c.status = 'rascunho'
ON CONFLICT (card_id, atleta_id) DO NOTHING;

-- ── 3. Publicar ──────────────────────────────────────────────────────────────
-- Mesma guarda do `/api/admin/escalacao/[id]/publicar`: prazo no futuro e pool
-- com pelo menos tantos atletas quanto o time exige titulares.

UPDATE escalacao_card c SET status = 'aberto', publicado_em = NOW()
 WHERE c.modo = 'fixo' AND c.status = 'rascunho' AND c.fecha_em > NOW()
   AND (SELECT COUNT(*) FROM escalacao_card_atleta ca WHERE ca.card_id = c.id) >= c.n_titulares;

DROP TABLE _pool;
