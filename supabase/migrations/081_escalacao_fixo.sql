-- Modo Fixo: formação com posição por slot, teto por clube e um time por card.
--
-- Três mudanças de regra, todas decididas pelo dono em 08/08/2026.
--
-- ── 1. Cai o "um time por modo por mês" ────────────────────────────────────────
-- A 075 trazia `UNIQUE (user_id, mes, modo)` (invariante C2, Art. 5): um time de
-- fixo por mês ATRAVESSANDO todas as ligas. A decisão agora é o oposto — o
-- usuário paga 200 Z$ no mix, +200 no Brasileirão, +200 na NBA, quantos cards
-- quiser, cada um com entrada própria. `UNIQUE (user_id, card_id)` continua
-- valendo e já garante o que sobra da regra: um time por Convocação.
-- Isto muda a economia do módulo: a exposição de emissão de Z$ de um usuário
-- deixa de ser um card e passa a ser N. O disjuntor `teto_emissao_z` continua
-- sendo POR CARD, então cada card segue limitado — mas o total do mês agora é a
-- soma dos tetos, e é isso que precisa ser olhado na abertura de cada Convocação.
--
-- ── 2. Formação com posição ───────────────────────────────────────────────────
-- No mix qualquer atleta serve em qualquer slot. No fixo não: slot de goleiro só
-- aceita goleiro. `escalacao_card.formacao` guarda o desenho do time como dado —
-- linhas do campo, e a posição exigida por slot. Um esporte novo é um INSERT,
-- como todo o resto do módulo; não há código por esporte nem no banco nem na UI.
--
-- O contrato com `escalacao_time_atleta.ordem` é o que faz isso funcionar sem
-- coluna nova: achatando `formacao->'linhas'` na ordem em que estão, o slot de
-- índice N é o titular de `ordem = N`. Por isso a RPC de salvar passa a receber
-- arrays COM buracos (NULL) — compactar deslocaria a posição de todo mundo
-- depois do buraco e um zagueiro cairia no slot de goleiro.
--
-- `pos: null` num slot = qualquer posição (o Flex da NFL, o quinto do Valorant).
--
-- ── 3. Teto por clube ─────────────────────────────────────────────────────────
-- No fixo o teto por esporte não só não restringe nada (é um esporte só) como
-- IMPEDE o modo de existir: `escalacao_esporte.teto_titulares = 4` e
-- `escalacao_competicao.teto_titulares = 3` (Brasileirão, Champions) foram
-- escritos para o mix, onde limitam a concentração num esporte. Num card de
-- futebol com 11 titulares eles rejeitariam qualquer time. Por isso os dois
-- tetos passam a valer só no mix.
--
-- O que dá graça à escalação do fixo é o teto por clube/franquia: 3 por clube no
-- Brasileirão, 2 por franquia na NBA e na NFL, 2 por organização no Valorant.

-- ── Schema ───────────────────────────────────────────────────────────────────

ALTER TABLE escalacao_time
  DROP CONSTRAINT IF EXISTS escalacao_time_user_id_mes_modo_key;

ALTER TABLE escalacao_card
  ADD COLUMN IF NOT EXISTS formacao       JSONB,
  ADD COLUMN IF NOT EXISTS teto_por_clube SMALLINT
    CHECK (teto_por_clube IS NULL OR teto_por_clube > 0);

-- Termos publicados são imutáveis (Art. 33 + CDC art. 30). Formação e teto por
-- clube são termos: mudar depois da publicação invalidaria times já escalados.
CREATE OR REPLACE FUNCTION public.escalacao_tg_card_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF OLD.status = 'rascunho' THEN
    RETURN NEW;
  END IF;

  IF NEW.entrada_z             IS DISTINCT FROM OLD.entrada_z
  OR NEW.pontos_por_z          IS DISTINCT FROM OLD.pontos_por_z
  OR NEW.n_titulares           IS DISTINCT FROM OLD.n_titulares
  OR NEW.n_reservas            IS DISTINCT FROM OLD.n_reservas
  OR NEW.teto_por_esporte      IS DISTINCT FROM OLD.teto_por_esporte
  OR NEW.teto_conta_reservas   IS DISTINCT FROM OLD.teto_conta_reservas
  OR NEW.multiplicador_capitao IS DISTINCT FROM OLD.multiplicador_capitao
  OR NEW.fecha_em              IS DISTINCT FROM OLD.fecha_em
  OR NEW.modo                  IS DISTINCT FROM OLD.modo
  OR NEW.mes                   IS DISTINCT FROM OLD.mes
  OR NEW.competicao_id         IS DISTINCT FROM OLD.competicao_id
  OR NEW.formacao              IS DISTINCT FROM OLD.formacao
  OR NEW.teto_por_clube        IS DISTINCT FROM OLD.teto_por_clube THEN
    RAISE EXCEPTION 'escalacao: os termos do card já foram publicados e não podem mudar';
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Validação de composição (T1) ─────────────────────────────────────────────
-- Acrescenta posição por slot e teto por clube ao que já existia.

CREATE OR REPLACE FUNCTION public.escalacao_valida_time(p_time uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_time  escalacao_time%ROWTYPE;
  v_card  escalacao_card%ROWTYPE;
  v_n     INTEGER;
  v_rec   RECORD;
BEGIN
  SELECT * INTO v_time FROM escalacao_time WHERE id = p_time;
  IF NOT FOUND OR v_time.status = 'rascunho' THEN
    RETURN;
  END IF;

  SELECT * INTO v_card FROM escalacao_card WHERE id = v_time.card_id;

  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND papel = 'titular';
  IF v_n <> v_card.n_titulares THEN
    RAISE EXCEPTION 'escalacao: o time precisa de % titulares (tem %)',
      v_card.n_titulares, v_n;
  END IF;

  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND papel = 'reserva';
  IF v_n <> v_card.n_reservas THEN
    RAISE EXCEPTION 'escalacao: o time precisa de % reservas (tem %)',
      v_card.n_reservas, v_n;
  END IF;

  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time
     AND ((papel = 'titular' AND ordem > v_card.n_titulares)
       OR (papel = 'reserva' AND ordem > v_card.n_reservas));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'escalacao: ordem de slot fora dos limites do card';
  END IF;

  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND capitao;
  IF v_n > 1 THEN
    RAISE EXCEPTION 'escalacao: no máximo um capitão por time';
  END IF;
  SELECT COUNT(*) INTO v_n FROM escalacao_time_atleta
   WHERE time_id = p_time AND capitao AND papel <> 'titular';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'escalacao: o capitão precisa ser titular';
  END IF;

  -- Teto por esporte e por competição são regras de CONCENTRAÇÃO: existem para
  -- impedir que o time do mix seja quatro quintos de UFC. Num card de fixo o
  -- esporte e a liga são um só por definição, então aplicá-los ali só rejeitaria
  -- todo time possível (futebol pede 11, o teto do esporte é 4).
  IF v_card.modo = 'mix' THEN
    FOR v_rec IN
      SELECT ca.esporte_key,
             COUNT(*) AS usados,
             LEAST(e.teto_titulares, v_card.teto_por_esporte) AS teto
        FROM escalacao_time_atleta ta
        JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
        JOIN escalacao_esporte     e  ON e.key = ca.esporte_key
       WHERE ta.time_id = p_time
         AND (v_card.teto_conta_reservas OR ta.papel = 'titular')
       GROUP BY ca.esporte_key, e.teto_titulares
    LOOP
      IF v_rec.usados > v_rec.teto THEN
        RAISE EXCEPTION 'escalacao: máximo de % atletas de % (tem %)',
          v_rec.teto, v_rec.esporte_key, v_rec.usados;
      END IF;
    END LOOP;

    FOR v_rec IN
      SELECT co.slug, co.teto_titulares AS teto, COUNT(*) AS usados
        FROM escalacao_time_atleta ta
        JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
        JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
        JOIN escalacao_competicao  co ON co.id = a.competicao_id
       WHERE ta.time_id = p_time
         AND co.teto_titulares IS NOT NULL
         AND (v_card.teto_conta_reservas OR ta.papel = 'titular')
       GROUP BY co.slug, co.teto_titulares
    LOOP
      IF v_rec.usados > v_rec.teto THEN
        RAISE EXCEPTION 'escalacao: máximo de % atletas de % (tem %)',
          v_rec.teto, v_rec.slug, v_rec.usados;
      END IF;
    END LOOP;
  END IF;

  IF v_card.modo = 'fixo' THEN
    SELECT COUNT(*) INTO v_n
      FROM escalacao_time_atleta ta
      JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
      JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
     WHERE ta.time_id = p_time
       AND (a.competicao_id IS DISTINCT FROM v_card.competicao_id);
    IF v_n > 0 THEN
      RAISE EXCEPTION 'escalacao: no modo fixo todos os atletas são da liga do card';
    END IF;
  END IF;

  -- Teto por clube/franquia. Só conta atleta com `clube` preenchido: pool sem
  -- curadoria de clube não deve travar a escalação, só não é restringido.
  IF v_card.teto_por_clube IS NOT NULL THEN
    FOR v_rec IN
      SELECT a.clube, COUNT(*) AS usados
        FROM escalacao_time_atleta ta
        JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
        JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
       WHERE ta.time_id = p_time
         AND a.clube IS NOT NULL
         AND (v_card.teto_conta_reservas OR ta.papel = 'titular')
       GROUP BY a.clube
    LOOP
      IF v_rec.usados > v_card.teto_por_clube THEN
        RAISE EXCEPTION 'escalacao: máximo de % atletas do % (tem %)',
          v_card.teto_por_clube, v_rec.clube, v_rec.usados;
      END IF;
    END LOOP;
  END IF;

  -- Posição exigida por slot. O slot de índice N (achatando as linhas na ordem)
  -- é o titular de `ordem = N`; `banco` faz o mesmo pelas reservas.
  IF v_card.formacao IS NOT NULL THEN
    SELECT COUNT(*) INTO v_n
      FROM jsonb_array_elements(v_card.formacao -> 'linhas') AS l(linha),
           jsonb_array_elements(l.linha) AS s(slot);
    IF v_n <> v_card.n_titulares THEN
      RAISE EXCEPTION 'escalacao: a formação do card tem % slots e o card pede % titulares',
        v_n, v_card.n_titulares;
    END IF;

    FOR v_rec IN
      WITH slot AS (
        SELECT ROW_NUMBER() OVER (ORDER BY l.li, s.si) AS ordem, s.slot
          FROM jsonb_array_elements(v_card.formacao -> 'linhas')
                 WITH ORDINALITY AS l(linha, li),
               jsonb_array_elements(l.linha)
                 WITH ORDINALITY AS s(slot, si)
      )
      SELECT a.nome, a.posicao, slot.slot ->> 'rotulo' AS exigida, slot.slot -> 'pos' AS pos
        FROM escalacao_time_atleta ta
        JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
        JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
        JOIN slot ON slot.ordem = ta.ordem
       WHERE ta.time_id = p_time
         AND ta.papel = 'titular'
         AND jsonb_typeof(slot.slot -> 'pos') = 'array'
         AND (a.posicao IS NULL
              OR NOT (slot.slot -> 'pos' @> to_jsonb(a.posicao)))
    LOOP
      RAISE EXCEPTION 'escalacao: % não pode jogar na posição % (é %)',
        v_rec.nome, COALESCE(v_rec.exigida, v_rec.pos::text),
        COALESCE(v_rec.posicao, 'sem posição cadastrada');
    END LOOP;

    FOR v_rec IN
      WITH slot AS (
        SELECT ROW_NUMBER() OVER (ORDER BY b.bi) AS ordem, b.slot
          FROM jsonb_array_elements(COALESCE(v_card.formacao -> 'banco', '[]'::jsonb))
                 WITH ORDINALITY AS b(slot, bi)
      )
      SELECT a.nome, a.posicao, slot.slot ->> 'rotulo' AS exigida, slot.slot -> 'pos' AS pos
        FROM escalacao_time_atleta ta
        JOIN escalacao_card_atleta ca ON ca.id = ta.card_atleta_id
        JOIN escalacao_atleta      a  ON a.id  = ca.atleta_id
        JOIN slot ON slot.ordem = ta.ordem
       WHERE ta.time_id = p_time
         AND ta.papel = 'reserva'
         AND jsonb_typeof(slot.slot -> 'pos') = 'array'
         AND (a.posicao IS NULL
              OR NOT (slot.slot -> 'pos' @> to_jsonb(a.posicao)))
    LOOP
      RAISE EXCEPTION 'escalacao: % não pode ocupar o banco de % (é %)',
        v_rec.nome, COALESCE(v_rec.exigida, v_rec.pos::text),
        COALESCE(v_rec.posicao, 'sem posição cadastrada');
    END LOOP;
  END IF;
END;
$function$;

-- ── Salvar time: arrays com buracos ──────────────────────────────────────────
-- `ordem` deixa de ser "a posição na lista de escolhidos" e passa a ser "o slot
-- da formação". Por isso a RPC agora aceita NULL no meio do array e usa a
-- ORDINALITY original como `ordem`, descartando só os buracos.

CREATE OR REPLACE FUNCTION escalacao_salvar_time(
  p_user UUID, p_card UUID, p_nome TEXT, p_titulares UUID[], p_reservas UUID[]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card escalacao_card%ROWTYPE;
  v_time UUID;
  v_tit  INTEGER;
  v_res  INTEGER;
BEGIN
  SELECT * INTO v_card FROM escalacao_card WHERE id = p_card FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF v_card.status <> 'aberto' OR v_card.fecha_em <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF COALESCE(array_length(p_titulares, 1), 0) > v_card.n_titulares
     OR COALESCE(array_length(p_reservas, 1), 0) > v_card.n_reservas THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many');
  END IF;

  SELECT COUNT(*) INTO v_tit FROM unnest(p_titulares) AS t(id) WHERE t.id IS NOT NULL;
  SELECT COUNT(*) INTO v_res FROM unnest(p_reservas)  AS r(id) WHERE r.id IS NOT NULL;

  IF (v_tit + v_res) <> (
    SELECT COUNT(DISTINCT id) FROM unnest(p_titulares || p_reservas) AS s(id) WHERE s.id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;

  INSERT INTO escalacao_time (card_id, mes, modo, user_id, nome)
  VALUES (p_card, v_card.mes, v_card.modo, p_user, NULLIF(p_nome, ''))
  ON CONFLICT (user_id, card_id) DO UPDATE
    SET nome = COALESCE(NULLIF(EXCLUDED.nome, ''), escalacao_time.nome), updated_at = NOW()
  RETURNING id INTO v_time;

  BEGIN
    DELETE FROM escalacao_time_atleta WHERE time_id = v_time;

    INSERT INTO escalacao_time_atleta (time_id, card_id, card_atleta_id, papel, ordem)
    SELECT v_time, p_card, t.id, 'titular', t.ord
      FROM unnest(p_titulares) WITH ORDINALITY AS t(id, ord)
     WHERE t.id IS NOT NULL
    UNION ALL
    SELECT v_time, p_card, r.id, 'reserva', r.ord
      FROM unnest(p_reservas) WITH ORDINALITY AS r(id, ord)
     WHERE r.id IS NOT NULL;

    PERFORM escalacao_valida_time(v_time);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_lineup', 'detail', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', true, 'time_id', v_time,
    'completo', v_tit = v_card.n_titulares AND v_res = v_card.n_reservas
  );
END; $$;

REVOKE ALL ON FUNCTION escalacao_salvar_time(UUID, UUID, TEXT, UUID[], UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION escalacao_salvar_time(UUID, UUID, TEXT, UUID[], UUID[])
  TO service_role;

-- ── Os quatro cards de fixo ──────────────────────────────────────────────────
-- As formações são decisão de produto, então moram aqui e não só no banco de
-- produção. Nascem em rascunho: nenhuma pode ser publicada antes do pool chegar
-- com `posicao` e `clube` preenchidos, que é o que a validação lê.
--
-- Datas de setembro/2026 são provisórias — enquanto o card é rascunho o T6 deixa
-- mudar tudo. Entram como UPSERT porque o Brasileirão pode já existir.

INSERT INTO escalacao_card (
  modo, mes, competicao_id, titulo, n_titulares, n_reservas, teto_por_esporte,
  teto_conta_reservas, entrada_z, pontos_por_z, teto_emissao_z,
  abre_em, fecha_em, status, teto_por_clube, formacao)
SELECT 'fixo', DATE '2026-09-01', co.id, v.titulo, v.n_tit, v.n_res, v.n_tit + 1,
       false, 200, 1, 200000,
       TIMESTAMPTZ '2026-09-01 09:00-03', v.fecha, 'rascunho', v.teto_clube, v.formacao
  FROM (VALUES
    ('brasileirao', 'Brasileirão — Setembro/2026', 11, 3, 3,
     TIMESTAMPTZ '2026-09-05 09:00-03', '{
       "layout":"campo","resumo":"4-3-3 · máximo 3 por clube",
       "linhas":[
         [{"rotulo":"GOL","pos":["GOL"]}],
         [{"rotulo":"LAT","pos":["LAT"]},{"rotulo":"ZAG","pos":["ZAG"]},
          {"rotulo":"ZAG","pos":["ZAG"]},{"rotulo":"LAT","pos":["LAT"]}],
         [{"rotulo":"MEI","pos":["MEI"]},{"rotulo":"MEI","pos":["MEI"]},
          {"rotulo":"MEI","pos":["MEI"]}],
         [{"rotulo":"ATA","pos":["ATA"]},{"rotulo":"ATA","pos":["ATA"]},
          {"rotulo":"ATA","pos":["ATA"]}]],
       "banco":[{"rotulo":"BANCO","pos":null},{"rotulo":"BANCO","pos":null},
                {"rotulo":"BANCO","pos":null}]}'::jsonb),

    ('nfl', 'NFL — Setembro/2026', 11, 1, 2,
     TIMESTAMPTZ '2026-09-11 17:00-03', '{
       "layout":"campo","resumo":"Ataque + flex, kicker e defesa · máximo 2 por franquia",
       "linhas":[
         [{"rotulo":"WR","pos":["WR"]},{"rotulo":"WR","pos":["WR"]},
          {"rotulo":"WR","pos":["WR"]}],
         [{"rotulo":"TE","pos":["TE"]},{"rotulo":"TE","pos":["TE"]}],
         [{"rotulo":"QB","pos":["QB"]}],
         [{"rotulo":"RB","pos":["RB"]},{"rotulo":"RB","pos":["RB"]}],
         [{"rotulo":"FLEX","pos":["RB","WR","TE"]},{"rotulo":"K","pos":["K"]},
          {"rotulo":"DEF","pos":["DEF"]}]],
       "banco":[{"rotulo":"BANCO","pos":null}]}'::jsonb),

    ('nba', 'NBA — Setembro/2026', 5, 1, 2,
     TIMESTAMPTZ '2026-09-30 17:00-03', '{
       "layout":"quadra","resumo":"Quinteto · máximo 2 por franquia",
       "linhas":[
         [{"rotulo":"PIVÔ","pos":["PIVO","ALA-PIVO"]}],
         [{"rotulo":"ALA","pos":["ALA","ALA-PIVO","ALA-ARM"]},
          {"rotulo":"ALA","pos":["ALA","ALA-PIVO","ALA-ARM"]}],
         [{"rotulo":"ARM","pos":["ARM","ALA-ARM"]},
          {"rotulo":"ARM","pos":["ARM","ALA-ARM"]}]],
       "banco":[{"rotulo":"BANCO","pos":null}]}'::jsonb),

    ('vct', 'Valorant — Setembro/2026', 5, 1, 2,
     TIMESTAMPTZ '2026-09-30 17:00-03', '{
       "layout":"lista","resumo":"Uma função de cada · máximo 2 por organização",
       "linhas":[
         [{"rotulo":"DUELISTA","pos":["DUELISTA"]}],
         [{"rotulo":"INICIADOR","pos":["INICIADOR"]}],
         [{"rotulo":"SENTINELA","pos":["SENTINELA"]}],
         [{"rotulo":"CONTROLADOR","pos":["CONTROLADOR"]}],
         [{"rotulo":"FLEX","pos":null}]],
       "banco":[{"rotulo":"BANCO","pos":null}]}'::jsonb)
  ) AS v(slug, titulo, n_tit, n_res, teto_clube, fecha, formacao)
  JOIN escalacao_competicao co ON co.slug = v.slug
ON CONFLICT (mes, modo, competicao_id) WHERE modo = 'fixo' DO UPDATE
  SET formacao = EXCLUDED.formacao, teto_por_clube = EXCLUDED.teto_por_clube;

-- Cada card de fixo aponta para o ruleset publicado mais recente do seu esporte.
INSERT INTO escalacao_card_esporte (card_id, esporte_key, regra_id)
SELECT c.id, co.esporte_key, r.id
  FROM escalacao_card c
  JOIN escalacao_competicao co ON co.id = c.competicao_id
  JOIN LATERAL (
    SELECT id FROM escalacao_regra
     WHERE esporte_key = co.esporte_key AND publicado_em IS NOT NULL
     ORDER BY versao DESC LIMIT 1
  ) r ON true
 WHERE c.modo = 'fixo'
ON CONFLICT (card_id, esporte_key) DO NOTHING;
