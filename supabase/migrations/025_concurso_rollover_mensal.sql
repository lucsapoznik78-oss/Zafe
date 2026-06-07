-- ============================================================
-- 025 — Rollover mensal do Concurso
-- ============================================================
-- O Concurso é mensal: todo mês deve recomeçar do zero — carteira
-- ZC$ renovada (saldo_inicial), ranking zerado e novos eventos.
-- Como carteira/ranking/inscrições/palpites são todos chaveados por
-- `concurso_id`, basta existir um NOVO registro em `concursos` para o
-- mês corrente para que tudo recomece automaticamente.
--
-- `garantir_concurso_do_mes()` cria o concurso do mês atual caso não
-- haja nenhum concurso ATIVO cobrindo o instante atual. É idempotente
-- (no-op quando já existe um ativo, ou quando já existe um registro
-- para o mês) e serializada por advisory lock para evitar corrida
-- entre execuções simultâneas do cron.
--
-- Período em UTC (mesmo padrão dos registros existentes:
-- 2026-06-01 00:00:00+00 .. 2026-06-30 23:59:59+00). Demais campos
-- (saldo_inicial, premios, premiacao_total) herdam os DEFAULTs da
-- tabela, mantendo consistência com o restante.

CREATE OR REPLACE FUNCTION garantir_concurso_do_mes()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id     uuid;
  v_local  timestamp;      -- início do mês, sem timezone (para extrair mês/ano de forma determinística)
  v_inicio timestamptz;
  v_fim    timestamptz;
  v_mes    text;
  v_ano    text;
  v_now    timestamptz := now();
BEGIN
  -- Serializa criação concorrente (mesmo cron disparando em paralelo).
  PERFORM pg_advisory_xact_lock(982451653);

  -- Já existe concurso ATIVO cobrindo agora? Então nada a fazer.
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

  -- Limites do mês corrente em UTC.
  v_local  := date_trunc('month', (v_now AT TIME ZONE 'UTC'));
  v_inicio := v_local AT TIME ZONE 'UTC';
  v_fim    := v_inicio + interval '1 month' - interval '1 second';

  -- Já existe um registro para este mês (em qualquer status)? Retorna ele.
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
$$;
