-- Remove trigger e função antiga
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recriar função mais robusta
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _full_name TEXT;
  _avatar_url TEXT;
  _suffix INT := 0;
  _final_username TEXT;
BEGIN
  -- Extrair dados do metadata (email/senha e Google OAuth)
  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Gerar username: pegar base do metadata ou email, sanitizar
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    regexp_replace(
      lower(split_part(NEW.email, '@', 1)),
      '[^a-z0-9_]', '', 'g'
    )
  );

  -- Garantir que username não seja vazio
  IF _username = '' OR _username IS NULL THEN
    _username := 'user';
  END IF;

  -- Truncar se muito longo
  _username := left(_username, 20);

  -- Resolver conflito de username com sufixo numérico
  _final_username := _username;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM profiles WHERE username = _final_username
    );
    _suffix := _suffix + 1;
    _final_username := left(_username, 16) || _suffix::TEXT;
  END LOOP;

  -- Inserir perfil (ignora se já existir pelo id)
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (NEW.id, _final_username, _full_name, _avatar_url)
  ON CONFLICT (id) DO NOTHING;

  -- Inserir carteira zerada (ignora se já existir)
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Logar o erro mas não bloquear a criação do usuário
  RAISE WARNING 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
