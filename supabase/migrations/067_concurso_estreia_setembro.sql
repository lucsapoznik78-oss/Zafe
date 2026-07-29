-- 067 — Concurso estreia em setembro/2026
--
-- O Concurso volta a ser divulgado no site, mas como ANÚNCIO: a primeira edição
-- valendo é a de setembro/2026. Não existe concurso válido antes disso.
--
-- Problema que esta migration fecha: garantir_concurso_do_mes() roda todo dia e
-- cria uma temporada com status 'ativo' para o mês corrente. Sem trava, o cron
-- ressuscitaria a "Temporada Julho 2026" (e depois agosto) como concurso ativo,
-- fazendo o site anunciar como aberta uma edição que não vale — exatamente o que
-- não pode acontecer enquanto não há CNPJ + provedor PIX.
--
-- A função passa a ser no-op enquanto o mês corrente for anterior à estreia.
-- A edição de setembro já existe no banco com status 'agendado' e é respeitada
-- pela busca por periodo_inicio, então o cron não duplica nada quando setembro
-- chegar — só a promove implicitamente (a promoção para 'ativo' é feita à mão
-- junto com a virada da flag CONCURSO_EM_BREVE em lib/flags.ts).

CREATE OR REPLACE FUNCTION public.garantir_concurso_do_mes()
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id      uuid;
  v_local   timestamp;
  v_inicio  timestamptz;
  v_fim     timestamptz;
  v_mes     text;
  v_ano     text;
  v_now     timestamptz := now();
  -- Primeira edição válida do Concurso. Antes disso o cron não cria nada.
  v_estreia timestamptz := '2026-09-01 00:00:00+00';
BEGIN
  PERFORM pg_advisory_xact_lock(982451653);

  SELECT id INTO v_id
  FROM concursos
  WHERE status = 'ativo'
    AND periodo_inicio <= v_now
    AND periodo_fim >= v_now
  ORDER BY periodo_inicio DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_local  := date_trunc('month', (v_now AT TIME ZONE 'UTC'));
  v_inicio := v_local AT TIME ZONE 'UTC';
  v_fim    := v_inicio + interval '1 month' - interval '1 second';

  -- Antes da estreia não se cria temporada: o Concurso ainda não começou.
  IF v_inicio < v_estreia THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM concursos
  WHERE periodo_inicio = v_inicio
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_mes := CASE EXTRACT(month FROM v_local)::int
    WHEN 1 THEN 'Janeiro'   WHEN 2 THEN 'Fevereiro' WHEN 3 THEN 'Março'
    WHEN 4 THEN 'Abril'     WHEN 5 THEN 'Maio'      WHEN 6 THEN 'Junho'
    WHEN 7 THEN 'Julho'     WHEN 8 THEN 'Agosto'    WHEN 9 THEN 'Setembro'
    WHEN 10 THEN 'Outubro'  WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro'
  END;
  v_ano := EXTRACT(year FROM v_local)::text;

  INSERT INTO concursos (titulo, descricao, status, periodo_inicio, periodo_fim)
  VALUES (
    'Concurso Liga Zafe — Temporada ' || v_mes || ' ' || v_ano,
    'Competição mensal de previsões: comece com ZC$ renovado e dispute prêmios em dinheiro.',
    'ativo',
    v_inicio,
    v_fim
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
