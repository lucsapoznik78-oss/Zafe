-- ============================================================
-- 052 — Jogo responsável + aceite de termos
-- ============================================================
-- Recomendação do especialista: "Jogo responsável — guardar os dados —
-- monitorar plataforma". Entrega mínima:
--   * Autoexclusão e pausa (cool-off): colunas de prazo no profile.
--   * Aceite de termos rastreado (quando/qual versão) — a página /termos era
--     estática, sem registro.
-- O monitoramento de plataforma reutiliza o ledger imutável `transactions`
-- (admin) — nenhuma tabela nova é necessária para isso.
--
-- IMPORTANTE: as colunas de pausa NÃO entram no GRANT do usuário (042/051).
-- Só o service-role (rota /api/jogo-responsavel) escreve, e a rota apenas
-- ESTENDE o prazo — o usuário não consegue encurtar/remover a própria pausa
-- pelo client (princípio de jogo responsável).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS self_excluded_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cooloff_until       TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at   TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_version       TEXT;

-- handle_new_user(): além de nascimento/endereço (051), registra o aceite de
-- termos vindo do signup (terms_version no metadata => aceito agora).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _birth    TEXT;
  _terms_v  TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  _birth   := NULLIF(NEW.raw_user_meta_data->>'birth_date', '');
  _terms_v := NULLIF(NEW.raw_user_meta_data->>'terms_version', '');

  INSERT INTO profiles (
    id, username, full_name, avatar_url, birth_date,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    terms_version, terms_accepted_at
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
    NULLIF(NEW.raw_user_meta_data->>'uf', ''),
    _terms_v,
    CASE WHEN _terms_v IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
