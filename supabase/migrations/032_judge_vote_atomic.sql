-- ============================================================
-- ZAFE — Migration 032: voto de juiz atômico (audit N10)
-- ============================================================
-- O upsert do voto em votar-resultado não re-checava fase/deadline no
-- momento da escrita: um voto correndo contra fecharVotacao podia ser
-- contado depois da apuração, corrompendo a supermaioria de 67%.
--
-- Esta função grava o voto num único UPDATE com todas as condições no
-- WHERE (juiz da rodada, ainda não votou, fase de votação correta, prazo
-- aberto). O re-check de EvalPlanQual do Postgres garante que, se
-- fecharVotacao mudar a fase concorrentemente, o voto NÃO é gravado.
--
-- SECURITY DEFINER service-role-only (rota valida a sessão antes).

CREATE OR REPLACE FUNCTION registrar_voto_juiz(
  p_topic UUID,
  p_judge UUID,
  p_round INTEGER,
  p_vote TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase TEXT := CASE WHEN p_round = 1 THEN 'voting' ELSE 'voting_round2' END;
  v_count INTEGER;
BEGIN
  IF p_vote NOT IN ('sim', 'nao') THEN
    RETURN jsonb_build_object('status', 'invalid_vote');
  END IF;

  UPDATE judge_outcome_votes v
  SET vote = p_vote, voted_at = NOW()
  FROM topics t
  WHERE v.topic_id = p_topic
    AND v.judge_id = p_judge
    AND v.round = p_round
    AND v.voted_at IS NULL
    AND t.id = v.topic_id
    AND t.private_phase = v_phase
    AND t.judge_vote_deadline > NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION registrar_voto_juiz(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION registrar_voto_juiz(UUID, UUID, INTEGER, TEXT) TO service_role;
