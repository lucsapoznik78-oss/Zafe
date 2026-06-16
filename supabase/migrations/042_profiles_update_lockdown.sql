-- ============================================================
-- ZAFE — Migration 042: trava o UPDATE de profiles (audit G1/G5/G7/G21)
-- ============================================================
-- G1: a policy profiles_own_update era FOR UPDATE USING (auth.uid()=id) sem
-- WITH CHECK e sem grant por coluna, então qualquer usuário autenticado podia
-- escrever colunas privilegiadas direto do client do navegador:
--   is_admin=true (takeover total), is_premium=true (G5 — fura o paywall),
--   cpf/kyc_verified (G7 — fura o KYC do concurso com prêmio em R$), banned.
--
-- Correção (defesa em profundidade, RLS + grant por coluna):
--   1. REVOKE UPDATE em profiles de authenticated/anon
--   2. GRANT UPDATE só nas colunas de exibição/perfil que o app escreve com o
--      client do usuário (username, full_name, avatar_url, birth_date e os
--      campos de 2FA). Colunas privilegiadas (is_admin, is_premium,
--      premium_until, kyc_verified, cpf, banned, referral_code, referred_by)
--      passam a ser service-role-only.
--   3. Recria a policy com WITH CHECK (auth.uid()=id) — o usuário não pode
--      reapontar a linha para outro id.
--
-- G21: garante que cpf/kyc_verified existam como colunas numeradas (estavam só
-- no RODAR_NO_SUPABASE.sql) para o índice abaixo e para um replay limpo.

-- G21 — colunas de KYC (idempotente; em prod já podem existir)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT false;

-- G7 — CPF único entre contas (fecha o TOCTOU Sybil do KYC do concurso).
-- Parcial: ignora linhas sem CPF.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON profiles (cpf) WHERE cpf IS NOT NULL;

-- G1/G5/G7 — trava do UPDATE
REVOKE UPDATE ON profiles FROM authenticated;
REVOKE UPDATE ON profiles FROM anon;

GRANT UPDATE (username, full_name, avatar_url, birth_date,
              two_fa_enabled, two_fa_method, phone)
  ON profiles TO authenticated;

DROP POLICY IF EXISTS profiles_own_update ON profiles;
CREATE POLICY profiles_own_update ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
