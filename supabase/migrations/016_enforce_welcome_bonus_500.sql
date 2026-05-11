-- Migração 016: garante bônus inicial de 500 Z$ para novos usuários.
-- Aplicar depois da 015_add_transaction_bonus_types.sql.

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
  _username   := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
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

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO transactions (user_id, type, amount, net_amount, description)
  VALUES (NEW.id, 'bonus', 500, 500, 'Bônus de boas-vindas - bem-vindo à Zafe!')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;

WITH eligible_users AS (
  SELECT w.user_id
  FROM wallets w
  WHERE w.balance = 0
    AND NOT EXISTS (
      SELECT 1
      FROM bets b
      WHERE b.user_id = w.user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      WHERE t.user_id = w.user_id
    )
),
updated_wallets AS (
  UPDATE wallets w
  SET balance = 500
  FROM eligible_users eu
  WHERE w.user_id = eu.user_id
  RETURNING w.user_id
)
INSERT INTO transactions (user_id, type, amount, net_amount, description)
SELECT user_id, 'bonus', 500, 500, 'Bônus de boas-vindas - bem-vindo à Zafe!'
FROM updated_wallets;
