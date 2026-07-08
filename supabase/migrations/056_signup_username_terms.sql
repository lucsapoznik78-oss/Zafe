-- ============================================================
-- 056 — handle_new_user: username único com sufixo + termos + telefone
-- ============================================================
-- Restaura duas capacidades que a 053 perdeu ao recriar a função:
--  * resolução de colisão de username com sufixo numérico (da 016). Sem ela,
--    um username repetido estoura unique_violation dentro do EXCEPTION
--    (que insere o MESMO username de novo) e o signup falha com
--    "Database error saving new user". Google usa o prefixo do email como
--    username, então colisões são comuns.
--  * registro do aceite dos termos vindo do metadata (da 052).
-- Novidades:
--  * phone entra pelo metadata (o form de cadastro novo coleta telefone;
--    o update client-side pós-signup nunca funcionou porque signup com
--    confirmação de email não cria sessão).
--  * campos de endereço saem do signup (o form não coleta mais; o fluxo de
--    prêmio em R$ pode voltar a pedir depois, se necessário).
-- Mantém o comportamento da 053 para CPF (metadata → profile; se o CPF já
-- pertence a outra conta, cria o profile sem CPF e o gate cobra de novo).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username       TEXT;
  _final_username TEXT;
  _suffix         INT := 0;
  _birth          TEXT;
  _cpf            TEXT;
  _phone          TEXT;
  _terms_v        TEXT;
BEGIN
  _username := lower(COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  ));
  _username := left(regexp_replace(_username, '[^a-z0-9_]', '', 'g'), 20);
  IF _username = '' OR _username IS NULL THEN _username := 'user'; END IF;

  -- Colisão → sufixo numérico (joao, joao1, joao2…)
  _final_username := _username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = _final_username);
    _suffix := _suffix + 1;
    _final_username := left(_username, 16) || _suffix::TEXT;
  END LOOP;

  _birth := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');

  _cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');
  IF _cpf IS NOT NULL AND _cpf !~ '^\d{11}$' THEN
    _cpf := NULL;
  END IF;

  _phone := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '');
  IF _phone IS NOT NULL AND (length(_phone) < 10 OR length(_phone) > 11) THEN
    _phone := NULL;
  END IF;

  _terms_v := NULLIF(NEW.raw_user_meta_data->>'terms_version', '');

  BEGIN
    INSERT INTO profiles (
      id, username, full_name, avatar_url, birth_date, cpf, kyc_verified,
      phone, terms_version, terms_accepted_at
    )
    VALUES (
      NEW.id,
      _final_username,
      COALESCE(NEW.raw_user_meta_data->>'full_name', _final_username),
      NEW.raw_user_meta_data->>'avatar_url',
      CASE WHEN _birth ~ '^\d{4}-\d{2}-\d{2}$' THEN _birth::date ELSE NULL END,
      _cpf,
      _cpf IS NOT NULL,
      _phone,
      _terms_v,
      CASE WHEN _terms_v IS NOT NULL THEN now() END
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- CPF já vinculado a outra conta: cria o profile sem CPF; o gate
    -- /completar-cadastro pede um CPF válido no primeiro login.
    INSERT INTO profiles (
      id, username, full_name, avatar_url, birth_date,
      phone, terms_version, terms_accepted_at
    )
    VALUES (
      NEW.id,
      _final_username,
      COALESCE(NEW.raw_user_meta_data->>'full_name', _final_username),
      NEW.raw_user_meta_data->>'avatar_url',
      CASE WHEN _birth ~ '^\d{4}-\d{2}-\d{2}$' THEN _birth::date ELSE NULL END,
      _phone,
      _terms_v,
      CASE WHEN _terms_v IS NOT NULL THEN now() END
    )
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
