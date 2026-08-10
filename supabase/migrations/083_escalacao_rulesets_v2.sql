-- 083 — Recalibragem de escala dos quatro esportes de liga (modo fixo).
--
-- O QUE ESTAVA ERRADO
-- Os manuais de futebol, NFL, NBA e Valorant foram escritos POR PARTIDA. O modo
-- fixo trava o time antes da primeira rodada e soma o mês inteiro. Com a v1, um
-- time médio de Brasileirão emitia ~880 Z$ contra 200 de entrada, e um de NFL
-- passava de 1.500 — para todo mundo, não só para quem escalou bem. Um atacante
-- com 3 gols no mês fazia 150 Z$ sozinho e quase pagava o time inteiro.
--
-- O QUE MUDA
-- Cada v2 é a v1 dividida por um fator ÚNICO (futebol/NFL/NBA ÷5, Valorant
-- ÷2,5). Só a ESCALA muda: um gol continua valendo 1,67 vitória, um clutch
-- continua valendo meio MVP. O julgamento dos manuais sobre o que vale mais que
-- o quê fica intacto — a recalibragem não reabre essa discussão de contrabando.
-- O Valorant leva um fator menor porque um time de 5 joga ~4 séries no mês (20
-- atuações) contra as 44 de um time de 11 no futebol e as 65 da NBA.
--
-- A conta está em `lib/escalacao/__tests__/calibragem.test.ts`, com as
-- frequências como constantes nomeadas: os quatro times médios caem na faixa de
-- 150–250 Z$ no mês.
--
-- OS ESPORTES DO MIX NÃO MUDAM
-- UFC e boxe têm no máximo uma luta no mês, a F1 tira média e surf e tênis
-- contam só o evento designado. Nenhum deles soma dezenas de eventos, então a
-- escala por partida do manual já é a escala do mês.
--
-- A v1 NÃO É APAGADA
-- Ruleset publicado é imutável (Art. 24 § único, trigger T5). A v1 fica como
-- registro do que vigorou; a emenda é uma versão nova, como manda o regulamento.

BEGIN;

-- ------------------------------------------------------------
-- 1. Nenhum time pagou sob os termos antigos
-- ------------------------------------------------------------
-- Reduzir a pontuação de um card em que alguém já pagou 200 Z$ seria mudar o
-- prêmio depois da inscrição (Art. 33 / CDC art. 30). Hoje os quatro cards de
-- fixo só têm rascunhos; se isso deixar de ser verdade, a migration para aqui.

DO $$
DECLARE v_inscritos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_inscritos
  FROM escalacao_time t
  JOIN escalacao_card c ON c.id = t.card_id
  WHERE c.modo = 'fixo' AND t.status <> 'rascunho';

  IF v_inscritos > 0 THEN
    RAISE EXCEPTION
      'Abortado: % time(s) já inscrito(s) em card de fixo. Trocar o ruleset agora mudaria os termos depois do pagamento.',
      v_inscritos;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. As quatro v2
-- ------------------------------------------------------------
-- `conteudo_hash` é sha256 de JSON.stringify({regras, stats}) — mesmo formato
-- que `scripts/seed-escalacao-regras.mts` gera, para que o seed reconheça estas
-- linhas como já publicadas e não tente reescrevê-las.

INSERT INTO escalacao_regra
  (esporte_key, versao, regras, stats, teto_evento, piso_evento, agregacao_mes, ev_alvo, conteudo_hash, publicado_em)
VALUES
  ('futebol', 2, '[{"tipo":"lookup","rotulo":"Resultado do time","stat":"resultado","mapa":{"vitoria":6,"empate":2,"derrota":-2,"nao_jogou":0}},{"tipo":"linear","rotulo":"Gols marcados","stat":"gols","fator":10},{"tipo":"linear","rotulo":"Assistências","stat":"assistencias","fator":5},{"tipo":"flag","rotulo":"Jogo sem sofrer gol","stat":"sem_sofrer_gol","pontos":4},{"tipo":"flag","rotulo":"Cartão vermelho","stat":"cartao_vermelho","pontos":-4},{"tipo":"linear","rotulo":"Gol contra","stat":"gols_contra","fator":-4}]'::jsonb, '[{"key":"resultado","tipo":"cat","rotulo":"Resultado do time","opcoes":["vitoria","empate","derrota","nao_jogou"]},{"key":"gols","tipo":"num","rotulo":"Gols marcados"},{"key":"assistencias","tipo":"num","rotulo":"Assistências"},{"key":"sem_sofrer_gol","tipo":"bool","rotulo":"Jogo sem sofrer gol","ajuda":"Só para goleiro ou zagueiro"},{"key":"cartao_vermelho","tipo":"bool","rotulo":"Cartão vermelho"},{"key":"gols_contra","tipo":"num","rotulo":"Gols contra"}]'::jsonb, 9999, -9999, 'soma', 18, '420a267041274c6f65c12c194b6e9583904e8368f698a54ae06f99dad0a5a2a7', NOW()),
  ('nba', 2, '[{"tipo":"lookup","rotulo":"Resultado do time","stat":"resultado","mapa":{"vitoria":6,"derrota":-2,"nao_jogou":0}},{"tipo":"lookup","rotulo":"Duplo-duplo","stat":"duplo","mapa":{"triple_double":10,"double_double":4,"nenhum":0}},{"tipo":"flag","rotulo":"Cesta da vitória / MVP do jogo","stat":"mvp","pontos":4}]'::jsonb, '[{"key":"resultado","tipo":"cat","rotulo":"Resultado do time","opcoes":["vitoria","derrota","nao_jogou"]},{"key":"duplo","tipo":"cat","rotulo":"Duplo-duplo","opcoes":["nenhum","double_double","triple_double"]},{"key":"mvp","tipo":"bool","rotulo":"Cesta da vitória ou MVP do jogo"}]'::jsonb, 9999, -9999, 'soma', 40, 'b5b3f1067cc0cd2dc9e965ffbb5ee7c023623782ee36a3c40b32878f34715d62', NOW()),
  ('nfl', 2, '[{"tipo":"lookup","rotulo":"Resultado do time","stat":"resultado","mapa":{"vitoria":6,"derrota":-2,"nao_jogou":0}},{"tipo":"linear","rotulo":"Touchdowns marcados","stat":"touchdowns","fator":10},{"tipo":"linear","rotulo":"Passes para touchdown","stat":"passes_td","fator":4},{"tipo":"linear","rotulo":"Field goal / defesa decisiva","stat":"jogadas_decisivas","fator":2},{"tipo":"linear","rotulo":"Turnovers","stat":"turnovers","fator":-4}]'::jsonb, '[{"key":"resultado","tipo":"cat","rotulo":"Resultado do time","opcoes":["vitoria","derrota","nao_jogou"]},{"key":"touchdowns","tipo":"num","rotulo":"Touchdowns marcados"},{"key":"passes_td","tipo":"num","rotulo":"Passes para touchdown"},{"key":"jogadas_decisivas","tipo":"num","rotulo":"Field goals / defesas decisivas","ajuda":"Quantidade, não pontos do placar"},{"key":"turnovers","tipo":"num","rotulo":"Turnovers (interceptação ou fumble)"}]'::jsonb, 9999, -9999, 'soma', 18, '02d7dee0efe342c9388d92092b4ff89d6575cef8078c816e33faa4a92b507b2f', NOW()),
  ('valorant', 2, '[{"tipo":"lookup","rotulo":"Resultado da série","stat":"resultado","mapa":{"vitoria":12,"derrota":-4,"nao_jogou":0}},{"tipo":"flag","rotulo":"MVP da partida","stat":"mvp","pontos":20},{"tipo":"linear","rotulo":"Aces","stat":"aces","fator":8},{"tipo":"linear","rotulo":"Clutches vencidos","stat":"clutches","fator":6}]'::jsonb, '[{"key":"resultado","tipo":"cat","rotulo":"Resultado da série","opcoes":["vitoria","derrota","nao_jogou"]},{"key":"mvp","tipo":"bool","rotulo":"MVP da partida"},{"key":"aces","tipo":"num","rotulo":"Aces (5 kills numa round)"},{"key":"clutches","tipo":"num","rotulo":"Clutches vencidos"}]'::jsonb, 9999, -9999, 'soma', 40, '187fa8aee644f3fbd07f5b221731c086aeb0ba763d1e0ab0011cf2ea9a84398d', NOW())
ON CONFLICT (esporte_key, versao) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Repontar os cards de fixo para a v2
-- ------------------------------------------------------------
-- `escalacao_card_atleta.regra_id` é NOT NULL e aponta para
-- `escalacao_card_esporte(card_id, esporte_key, regra_id)` — a FK que torna
-- impossível guardar um score calculado com um ruleset que o card não fixou.
-- Justamente por isso as duas linhas não podem ser atualizadas em sequência:
-- qualquer ordem quebra a FK no meio do caminho, e ela não é DEFERRABLE. Solta-se
-- a restrição, atualiza-se o par, e recria-se idêntica — a garantia volta ao fim
-- da mesma transação.

ALTER TABLE escalacao_card_atleta
  DROP CONSTRAINT escalacao_card_atleta_card_id_esporte_key_regra_id_fkey;

WITH alvo AS (
  SELECT ce.card_id, ce.esporte_key, r2.id AS regra_v2
  FROM escalacao_card_esporte ce
  JOIN escalacao_card c ON c.id = ce.card_id
  JOIN escalacao_regra r2 ON r2.esporte_key = ce.esporte_key AND r2.versao = 2
  WHERE c.modo = 'fixo'
),
atletas AS (
  UPDATE escalacao_card_atleta ca
  SET regra_id = a.regra_v2
  FROM alvo a
  WHERE ca.card_id = a.card_id AND ca.esporte_key = a.esporte_key
  RETURNING 1
)
UPDATE escalacao_card_esporte ce
SET regra_id = a.regra_v2
FROM alvo a
WHERE ce.card_id = a.card_id AND ce.esporte_key = a.esporte_key;

ALTER TABLE escalacao_card_atleta
  ADD CONSTRAINT escalacao_card_atleta_card_id_esporte_key_regra_id_fkey
  FOREIGN KEY (card_id, esporte_key, regra_id)
  REFERENCES escalacao_card_esporte(card_id, esporte_key, regra_id);

-- ------------------------------------------------------------
-- 4. Conferência
-- ------------------------------------------------------------

DO $$
DECLARE v_v1 INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_v1
  FROM escalacao_card_esporte ce
  JOIN escalacao_card c ON c.id = ce.card_id
  JOIN escalacao_regra r ON r.id = ce.regra_id
  WHERE c.modo = 'fixo' AND r.versao <> 2;

  IF v_v1 > 0 THEN
    RAISE EXCEPTION 'Sobraram % card(s) de fixo apontando para ruleset fora da v2', v_v1;
  END IF;
END $$;

COMMIT;
