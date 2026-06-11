-- ============================================================
-- ZAFE — Migration 031: inscrição atômica no concurso (audit N6 + N7)
-- ============================================================
-- N6: inscrever/reentrar inseriam inscricoes_concurso e concurso_wallets em
-- dois awaits independentes — falha no meio deixava inscrição sem carteira
-- (ou carteira órfã). Agora ambos os INSERTs acontecem numa única transação.
--
-- N7: os INSERTs omitiam saldo_inicial, então a coluna ficava no DEFAULT 1000
-- mesmo quando o concurso tinha outro saldo — quebrando o ROI do ranking.
-- A função grava o saldo_inicial real do concurso nas duas tabelas.
--
-- SECURITY DEFINER service-role-only: mesma exceção consciente documentada
-- nas funções da Zafe Copa (027) — atomicidade multi-tabela que o client TS
-- não garante. A rota continua validando sessão/KYC/18+ antes do RPC.

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

  INSERT INTO inscricoes_concurso (user_id, concurso_id, saldo_inicial)
  VALUES (p_user, p_concurso, v_saldo)
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
  -- pelo bug antigo (não zera o saldo existente).
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
