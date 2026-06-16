-- ============================================================
-- ZAFE — Migration 041: corrige concurso_inscrever (coluna inexistente)
-- ============================================================
-- BUG (prod): a inscrição no concurso falhava com
--   ERROR: column "saldo_inicial" of relation "inscricoes_concurso" does not exist
-- A função 031 (audit N7) assumia que inscricoes_concurso tinha a coluna
-- saldo_inicial (snapshot p/ ROI), mas a tabela real só tem
-- (id, user_id, concurso_id, created_at) — a coluna nunca foi materializada.
--
-- A view de ranking em PROD (v_concurso_ranking) já rankeia por
-- concurso_wallets.balance e NÃO lê inscricoes_concurso.saldo_inicial, então
-- a coluna é morta. O fix correto é remover saldo_inicial do INSERT em
-- inscricoes_concurso (e não criar uma coluna que ninguém consome). O saldo
-- de entrada continua sendo gravado em concurso_wallets.balance — que é o que
-- o ranking efetivamente usa.
--
-- Demais semânticas preservadas: atomicidade multi-tabela (N6), saldo real
-- da carteira no already_enrolled (N18), SECURITY DEFINER service-role-only.

CREATE OR REPLACE FUNCTION concurso_inscrever(p_user UUID, p_concurso UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC(12,2);
  v_balance NUMERIC(12,2);
BEGIN
  -- Concurso precisa estar ativo e dentro do período (revalida no banco,
  -- fechando o TOCTOU entre a leitura na rota e a inscrição).
  SELECT saldo_inicial INTO v_saldo
  FROM concursos
  WHERE id = p_concurso
    AND status = 'ativo'
    AND periodo_inicio <= NOW()
    AND periodo_fim >= NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_active');
  END IF;

  INSERT INTO inscricoes_concurso (user_id, concurso_id)
  VALUES (p_user, p_concurso)
  ON CONFLICT (user_id, concurso_id) DO NOTHING;

  IF NOT FOUND THEN
    -- Já inscrito: devolve o saldo REAL da carteira (audit N18 — antes a
    -- rota devolvia saldo_inicial, mostrando ZC$ errado na UI).
    SELECT balance INTO v_balance
    FROM concurso_wallets
    WHERE user_id = p_user AND concurso_id = p_concurso;

    RETURN jsonb_build_object(
      'status', 'already_enrolled',
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- Carteira ZC$ na mesma transação. ON CONFLICT cobre carteira órfã criada
  -- pelo bug antigo (não zera o saldo existente). É aqui que o saldo de
  -- entrada do concurso vive — base do ranking.
  INSERT INTO concurso_wallets (user_id, concurso_id, balance)
  VALUES (p_user, p_concurso, v_saldo)
  ON CONFLICT (user_id, concurso_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM concurso_wallets
  WHERE user_id = p_user AND concurso_id = p_concurso;

  RETURN jsonb_build_object('status', 'ok', 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION concurso_inscrever(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION concurso_inscrever(UUID, UUID) TO service_role;
