-- ============================================================
-- ZAFE — Migration 034: colunas de 2FA em profiles (audit #13)
-- ============================================================
-- O código já lê/escreve two_fa_enabled, two_fa_method e phone
-- (components/auth/LoginForm.tsx, components/perfil/TwoFaSettings.tsx),
-- mas nenhuma migration as criava — ambientes recriados do zero quebram.
-- Em prod as colunas podem já existir (criadas manualmente): IF NOT EXISTS.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_fa_method TEXT CHECK (two_fa_method IN ('email', 'sms')),
  ADD COLUMN IF NOT EXISTS phone TEXT;
