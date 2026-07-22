-- RPC pra checar se um email tem conta em auth.users, sem expor o schema auth.
-- Usado pela tela "Esqueci minha senha" (/api/auth/email-exists) para dar
-- mensagem clara ("não encontramos essa conta") em vez do genérico "se
-- houver, enviamos". Ver migration 057 e componente LoginForm.
--
-- SECURITY DEFINER: roda com privilégios do owner (postgres) — só assim o
-- service role consegue ler auth.users via RPC. Retorna apenas boolean;
-- nenhum dado sensível vaza.

CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO service_role;
