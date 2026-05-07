-- Migração 013: bônus de boas-vindas (500 Z$) + correção labels ZC$ no concurso
-- Aplicar no SQL Editor do Supabase

-- Atualiza o trigger de criação de usuário para dar 500 Z$ de bônus
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _full_name TEXT;
  _avatar_url TEXT;
  _suffix INT := 0;
  _final_username TEXT;
BEGIN
  _full_name  := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  _avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  _username   := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  _username   := left(_username, 20);
  IF _username = '' THEN _username := 'user'; END IF;

  _final_username := _username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = _final_username);
    _suffix := _suffix + 1;
    _final_username := left(_username, 16) || _suffix::TEXT;
  END LOOP;

  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (NEW.id, _final_username, _full_name, _avatar_url)
  ON CONFLICT (id) DO NOTHING;

  -- Bônus de boas-vindas: 500 Z$ para todo novo usuário
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  -- Registrar transação do bônus
  INSERT INTO transactions (user_id, type, amount, net_amount, description)
  VALUES (NEW.id, 'bonus', 500, 500, 'Bônus de boas-vindas — bem-vindo à Zafe!')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
