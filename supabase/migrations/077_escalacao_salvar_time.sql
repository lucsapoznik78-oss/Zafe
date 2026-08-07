-- 077 — Modo Escalação: gravar a escalação numa transação só.
--
-- A superfície do usuário precisa trocar a escalação inteira de uma vez. Fazer
-- isso pelo PostgREST (DELETE dos slots, depois INSERT dos novos) usa DUAS
-- transações — e no intervalo o time fica com zero slots. Para um time em
-- rascunho tudo bem; para um time já INSCRITO o T1 (`CONSTRAINT TRIGGER`
-- diferido) roda no commit do DELETE, vê 0 titulares onde o card exige 10 e
-- recusa. Ou seja: pelo caminho REST um usuário inscrito nunca mais conseguiria
-- editar o time, que é exatamente o que o Art. 7 §3 garante que ele pode fazer
-- até `fecha_em`.
--
-- Esta RPC faz DELETE + INSERT na mesma transação, então o T1 só enxerga o
-- estado final. O bloco EXCEPTION existe pelo mesmo motivo do de
-- `escalacao_inscrever`: rollback do subbloco descarta os eventos de trigger
-- diferidos enfileirados, e o usuário recebe um motivo legível em vez de um
-- erro de banco.
--
-- Continua SEM tocar em dinheiro: gravar é de graça e reversível. O débito é
-- ato à parte, em `escalacao_inscrever`.

CREATE OR REPLACE FUNCTION escalacao_salvar_time(
  p_user       UUID,
  p_card       UUID,
  p_nome       TEXT,
  p_titulares  UUID[],
  p_reservas   UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card escalacao_card%ROWTYPE;
  v_time UUID;
  v_n    INTEGER;
BEGIN
  SELECT * INTO v_card FROM escalacao_card WHERE id = p_card FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_card.status <> 'aberto' OR v_card.fecha_em <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF COALESCE(array_length(p_titulares, 1), 0) > v_card.n_titulares
     OR COALESCE(array_length(p_reservas, 1), 0) > v_card.n_reservas THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many');
  END IF;

  -- Atleta repetido entre titulares e reservas. O UNIQUE (time_id,
  -- card_atleta_id) pegaria, mas com mensagem de constraint.
  SELECT COUNT(*) INTO v_n FROM (
    SELECT unnest(p_titulares || p_reservas) AS id
  ) s;
  IF v_n <> (SELECT COUNT(DISTINCT id) FROM (
               SELECT unnest(p_titulares || p_reservas) AS id) s2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;

  INSERT INTO escalacao_time (card_id, mes, modo, user_id, nome)
  VALUES (p_card, v_card.mes, v_card.modo, p_user, NULLIF(p_nome, ''))
  ON CONFLICT (user_id, card_id) DO UPDATE
    SET nome = COALESCE(NULLIF(EXCLUDED.nome, ''), escalacao_time.nome),
        updated_at = NOW()
  RETURNING id INTO v_time;

  BEGIN
    DELETE FROM escalacao_time_atleta WHERE time_id = v_time;

    INSERT INTO escalacao_time_atleta (time_id, card_id, card_atleta_id, papel, ordem)
    SELECT v_time, p_card, t.id, 'titular', t.ord
      FROM unnest(p_titulares) WITH ORDINALITY AS t(id, ord)
    UNION ALL
    SELECT v_time, p_card, r.id, 'reserva', r.ord
      FROM unnest(p_reservas) WITH ORDINALITY AS r(id, ord);

    -- Time já inscrito: a composição tem que continuar válida agora, não só no
    -- commit — senão o erro chegaria como falha de transação sem motivo legível.
    PERFORM escalacao_valida_time(v_time);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_lineup', 'detail', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'time_id', v_time,
    'completo', COALESCE(array_length(p_titulares, 1), 0) = v_card.n_titulares
            AND COALESCE(array_length(p_reservas, 1), 0) = v_card.n_reservas
  );
END;
$$;

REVOKE ALL ON FUNCTION escalacao_salvar_time(UUID, UUID, TEXT, UUID[], UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION escalacao_salvar_time(UUID, UUID, TEXT, UUID[], UUID[])
  TO service_role;

COMMENT ON FUNCTION escalacao_salvar_time(UUID, UUID, TEXT, UUID[], UUID[]) IS
  'Grava a escalação inteira em uma transação (Art. 7 §3 — editável até fecha_em). Não move Z$.';
