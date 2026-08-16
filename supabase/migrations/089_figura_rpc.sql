-- 089 — RPCs de dinheiro do personagem (SECURITY DEFINER, service_role only)
--
-- POR QUE RPC E NÃO `lib/wallet.ts`
--
-- `debitBalance()` torna cada débito atômico, mas não torna *débito + insert*
-- atômico — e é exatamente disso que a loja precisa. O padrão que já existe no
-- repo para compra fora de aposta (app/api/comunidade/[id]/contestar/route.ts:
-- select para ver se já tem → debita → insere) tem um buraco: em dois cliques
-- simultâneos as duas requisições leem "ainda não tem", as duas debitam, e o
-- segundo insert estoura na chave primária. O usuário pagou duas vezes por um
-- item só e não há crédito de volta em lugar nenhum. Lá sobrevive porque a taxa
-- é Z$ 10; num item de Z$ 800 não sobrevive.
--
-- Aqui as duas operações viram uma transação, e a ORDEM é o que resolve a
-- corrida. Ver o comentário dentro de figura_comprar.

-- ------------------------------------------------------------------------
-- 1. Desbloquear o editor de personagem — Z$ 100, uma vez na vida.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION figura_desbloquear(p_user UUID, p_preco NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_preco < 0 OR p_preco > 100000 THEN
    RAISE EXCEPTION 'preco fora de faixa' USING ERRCODE = 'P0001';
  END IF;

  -- Marca PRIMEIRO, com o estado anterior no WHERE. Duas requisições
  -- simultâneas: a segunda trava na linha, acorda depois do commit da primeira,
  -- não encontra mais `false` e afeta 0 linhas. Quem decide a corrida é o banco,
  -- não um `if` na aplicação. Idempotente: N chamadas, um débito.
  UPDATE profiles SET figura_desbloqueada = true
   WHERE id = p_user AND figura_desbloqueada = false;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', true, 'ja_tinha', true, 'cobrado', 0);
  END IF;

  IF p_preco > 0 THEN
    -- Débito condicional: o WHERE é avaliado sob lock de linha, mais forte que
    -- o compare-and-set de lib/wallet.ts (não perde retry, não dá conflito
    -- espúrio quando dois ajustes fecham no mesmo saldo).
    UPDATE wallets SET balance = balance - p_preco
     WHERE user_id = p_user AND balance >= p_preco;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- EXCEPTION, não RETURN. Um RETURN aqui comitaria o UPDATE de cima e
    -- entregaria o desbloqueio de graça. Só a exceção desfaz.
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'saldo insuficiente' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO transactions (user_id, type, amount, net_amount, description)
    VALUES (p_user, 'figura_desbloqueio', -p_preco, -p_preco,
            'Desbloqueio do editor de personagem');
  END IF;

  RETURN jsonb_build_object('ok', true, 'ja_tinha', false, 'cobrado', p_preco);
END;
$$;

-- ------------------------------------------------------------------------
-- 2. Comprar um acessório.
-- ------------------------------------------------------------------------
-- `p_preco` vem de fora porque o catálogo mora em TypeScript, não em tabela. A
-- costura é segura por três razões: a função só tem EXECUTE para `service_role`
-- (logo o único chamador possível é a nossa rota); a rota lê o preço do próprio
-- catálogo e o corpo do request não tem campo de preço para adulterar; e o
-- range-check abaixo pega bug de chamador, não ataque de usuário.
CREATE OR REPLACE FUNCTION figura_comprar(p_user UUID, p_item TEXT, p_preco NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF p_item IS NULL OR length(p_item) = 0 OR length(p_item) > 64 THEN
    RAISE EXCEPTION 'item invalido' USING ERRCODE = 'P0001';
  END IF;
  IF p_preco < 0 OR p_preco > 100000 THEN
    RAISE EXCEPTION 'preco fora de faixa' USING ERRCODE = 'P0001';
  END IF;

  -- INSERT PRIMEIRO, débito depois. É a ordem que faz a rota ser idempotente:
  -- de dois cliques simultâneos, a segunda transação bloqueia no índice único
  -- até a primeira comitar, então encontra o conflito e afeta 0 linhas. Devolve
  -- 200 com `ja_possui`, que o cliente sabe renderizar. Na ordem inversa
  -- (debita → insere) as duas debitariam antes de qualquer uma descobrir a
  -- duplicata.
  INSERT INTO figura_inventario (user_id, item_id, preco_pago, origem)
  VALUES (p_user, p_item, p_preco, CASE WHEN p_preco > 0 THEN 'compra' ELSE 'inicial' END)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', true, 'ja_possui', true, 'cobrado', 0);
  END IF;

  IF p_preco > 0 THEN
    UPDATE wallets SET balance = balance - p_preco
     WHERE user_id = p_user AND balance >= p_preco;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- A linha mais sutil do arquivo: RAISE, nunca RETURN. Um RETURN comitaria o
    -- INSERT acima e o usuário sairia com o item sem pagar.
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'saldo insuficiente' USING ERRCODE = 'P0001';
    END IF;

    -- `reference_id` é UUID (001_initial) e o id do item é slug de texto, então
    -- o item vai na descrição. Quem quiser cruzar depois usa figura_inventario.
    INSERT INTO transactions (user_id, type, amount, net_amount, description)
    VALUES (p_user, 'figura_compra', -p_preco, -p_preco,
            'Acessório de personagem: ' || p_item);
  END IF;

  RETURN jsonb_build_object('ok', true, 'ja_possui', false, 'cobrado', p_preco);
END;
$$;

REVOKE ALL ON FUNCTION figura_desbloquear(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION figura_comprar(UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION figura_desbloquear(UUID, NUMERIC)  TO service_role;
GRANT EXECUTE ON FUNCTION figura_comprar(UUID, TEXT, NUMERIC) TO service_role;
