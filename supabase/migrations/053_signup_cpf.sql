-- ============================================================
-- 053 — CPF coletado no cadastro (form de signup)
-- ============================================================
-- O dono pediu o CPF visível no próprio formulário de cadastro (não num passo
-- pós-login). Como o signup com confirmação de email NÃO cria sessão imediata,
-- o caminho robusto é o mesmo do endereço/nascimento (migration 051): o CPF vai
-- em raw_user_meta_data (options.data do signUp) e este trigger — SECURITY
-- DEFINER — o grava no profile. Isto RELAXA a decisão da 051 (CPF passava a
-- entrar só via /api/kyc): o CPF agora pode transitar no user_metadata. É o
-- CPF do próprio usuário; o caminho de prêmio em R$ (concurso/inscrever) ainda
-- revalida com validarCPF antes de qualquer pagamento.
--
-- Unicidade: profiles_cpf_unique (migration 042) continua valendo. Se o CPF já
-- pertencer a outra conta, o INSERT com CPF falha — capturamos a exceção e
-- criamos o profile SEM CPF, deixando o gate /completar-cadastro cobrar de novo
-- (em vez de quebrar o signup inteiro e deixar a conta sem profile/wallet).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _birth    TEXT;
  _cpf      TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  _birth := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');

  -- CPF: só dígitos; aceita apenas 11 dígitos (validação de checksum é no
  -- client/validarCPF e revalidada no servidor no fluxo de prêmio).
  _cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');
  IF _cpf IS NOT NULL AND _cpf !~ '^\d{11}$' THEN
    _cpf := NULL;
  END IF;

  BEGIN
    INSERT INTO profiles (
      id, username, full_name, avatar_url, birth_date, cpf, kyc_verified,
      cep, logradouro, numero, complemento, bairro, cidade, uf
    )
    VALUES (
      NEW.id,
      _username,
      COALESCE(NEW.raw_user_meta_data->>'full_name', _username),
      NEW.raw_user_meta_data->>'avatar_url',
      CASE WHEN _birth ~ '^\d{4}-\d{2}-\d{2}$' THEN _birth::date ELSE NULL END,
      _cpf,
      _cpf IS NOT NULL,
      NULLIF(NEW.raw_user_meta_data->>'cep', ''),
      NULLIF(NEW.raw_user_meta_data->>'logradouro', ''),
      NULLIF(NEW.raw_user_meta_data->>'numero', ''),
      NULLIF(NEW.raw_user_meta_data->>'complemento', ''),
      NULLIF(NEW.raw_user_meta_data->>'bairro', ''),
      NULLIF(NEW.raw_user_meta_data->>'cidade', ''),
      NULLIF(NEW.raw_user_meta_data->>'uf', '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- CPF já vinculado a outra conta: cria o profile sem CPF; o gate
    -- /completar-cadastro pede um CPF válido no primeiro login.
    INSERT INTO profiles (
      id, username, full_name, avatar_url, birth_date,
      cep, logradouro, numero, complemento, bairro, cidade, uf
    )
    VALUES (
      NEW.id,
      _username,
      COALESCE(NEW.raw_user_meta_data->>'full_name', _username),
      NEW.raw_user_meta_data->>'avatar_url',
      CASE WHEN _birth ~ '^\d{4}-\d{2}-\d{2}$' THEN _birth::date ELSE NULL END,
      NULLIF(NEW.raw_user_meta_data->>'cep', ''),
      NULLIF(NEW.raw_user_meta_data->>'logradouro', ''),
      NULLIF(NEW.raw_user_meta_data->>'numero', ''),
      NULLIF(NEW.raw_user_meta_data->>'complemento', ''),
      NULLIF(NEW.raw_user_meta_data->>'bairro', ''),
      NULLIF(NEW.raw_user_meta_data->>'cidade', ''),
      NULLIF(NEW.raw_user_meta_data->>'uf', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END;

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
