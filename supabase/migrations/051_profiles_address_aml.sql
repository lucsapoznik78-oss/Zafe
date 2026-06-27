-- ============================================================
-- 051 — Endereço no perfil (AML) + coleta no cadastro
-- ============================================================
-- Recomendação do especialista: "Perfil com mais informações pra impedir
-- lavagem de dinheiro, endereço" coletado no "cadastro inicial".
-- Escopo confirmado pelo usuário: AUTO-DECLARADO (só validação de formato,
-- sem fornecedor externo). CPF/nascimento já existem (042/024); aqui
-- adicionamos ENDEREÇO e passamos a coletar endereço + nascimento no signup.
--
-- Como o signup com confirmação de email NÃO cria sessão imediata, a coleta
-- "no cadastro" usa o caminho robusto: os campos vão em raw_user_meta_data
-- (options.data do signUp) e o trigger handle_new_user() — SECURITY DEFINER —
-- os grava no profile. CPF continua via /api/kyc (admin, pós-login, com índice
-- UNIQUE), pra não expor o CPF em user_metadata.

-- 1) Colunas de endereço (auto-declaradas; aditivas e idempotentes).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cep         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logradouro  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS numero      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bairro      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cidade      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS uf          TEXT;

-- 2) Permite o usuário EDITAR o próprio endereço pelo client (perfil).
-- Mantém o lockdown da 042 para colunas privilegiadas (cpf/kyc/is_admin/…).
GRANT UPDATE (cep, logradouro, numero, complemento, bairro, cidade, uf)
  ON profiles TO authenticated;

-- 3) handle_new_user(): popula nascimento + endereço a partir do metadata
-- enviado no signup. Mantém a criação de profile/wallet idêntica à 001.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _birth    TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  _birth := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');

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

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
