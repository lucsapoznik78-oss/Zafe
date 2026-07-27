-- ============================================================
-- ZAFE — Migration 059: lockdown de segurança, Lote 1 (risco zero)
-- ============================================================
-- Origem: Zafe_Auditoria_Seguranca.docx (24/07/2026), achados F-02, F-04,
-- F-05, F-06 (parcial), F-12, F-13 + dois achados novos dos advisors.
--
-- Todo item aqui foi verificado como NÃO UTILIZADO pelo código da aplicação
-- (grep no repo em 27/07/2026), portanto nada deve quebrar:
--   - add_to_balance          → 0 chamadas no código
--   - generate_referral_code  → 0 chamadas no código
--   - handle_new_user         → trigger de auth, nunca chamada via RPC
--   - topic_outcomes          → escrito só via createAdminClient()
--   - desafios/desafio_bets   → 0 escritas no código (módulo legado)
--   - TRUNCATE/REFERENCES/TRIGGER → não expostos pelo PostgREST
--   - colunas de PII em profiles → nenhum componente cliente as lê
--
-- Fora deste lote (exigem mudança de código antes): F-01 (wallets),
-- F-07 (transactions), F-08 (bets) — /api/apostar e /api/amigos/aceitar-aposta
-- ainda debitam com o client do usuário.

-- ------------------------------------------------------------
-- F-02 — RPC add_to_balance executável por anônimos (CRÍTICO)
-- SECURITY DEFINER, aceita p_user_id e p_amount do cliente, não confere
-- auth.uid(). Permitia criar saldo do nada sem login.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.add_to_balance(uuid, numeric)
  FROM anon, authenticated, public;

-- Achados novos (Supabase advisors 0028/0029): outras SECURITY DEFINER
-- expostas como RPC sem necessidade.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon, authenticated, public;

-- ------------------------------------------------------------
-- F-13 — search_path mutável em funções SECURITY DEFINER
-- ------------------------------------------------------------
ALTER FUNCTION public.add_to_balance(uuid, numeric)      SET search_path = public;
ALTER FUNCTION public.handle_new_user()                  SET search_path = public;
ALTER FUNCTION public.generate_referral_code()           SET search_path = public;
ALTER FUNCTION public.bump_wallet_version()              SET search_path = public;
ALTER FUNCTION public.enforce_community_creator_no_bet() SET search_path = public;
ALTER FUNCTION public.garantir_concurso_do_mes()         SET search_path = public;

-- ------------------------------------------------------------
-- F-04 — topic_outcomes gravável por qualquer um (CRÍTICO)
-- outcomes_service_write era FOR ALL USING (true): sem login, qualquer um
-- escrevia o resultado que decide quem ganhou. Escrita passa a service_role.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS outcomes_service_write ON public.topic_outcomes;
REVOKE INSERT, UPDATE, DELETE ON public.topic_outcomes FROM anon, authenticated;
-- outcomes_public_read (FOR SELECT USING (true)) permanece: o pool é público.

-- ------------------------------------------------------------
-- F-05 — desafios / desafio_bets com UPDATE USING (true) (CRÍTICO)
-- Módulo legado sem escritas no código. As policies de INSERT legítimas
-- (desafios_authenticated_insert, desafio_bets_authenticated_insert) ficam.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS desafios_update_service     ON public.desafios;
DROP POLICY IF EXISTS desafio_bets_update_service ON public.desafio_bets;
REVOKE UPDATE, DELETE ON public.desafios     FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.desafio_bets FROM anon, authenticated;

-- ------------------------------------------------------------
-- F-06 (parcial) — PII de profiles legível sem login (CRÍTICO / LGPD)
-- profiles_public_read é USING (true) e anon tinha SELECT em todas as 29
-- colunas: cpf, birth_date, phone, endereço completo, self_excluded_until.
-- Aqui fechamos o vetor anônimo (o pior: não exige conta). O grant de
-- `authenticated` é tratado no Lote 2, junto com a separação de PII, porque
-- LoginForm ainda lê `phone` com o client do navegador (fluxo de 2FA).
-- ------------------------------------------------------------
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username, full_name, avatar_url, created_at, is_premium, referral_code)
  ON public.profiles TO anon;

-- Grants mortos, mas que são uma mina: INSERT cobria TODAS as colunas
-- (inclusive is_admin). Hoje não há policy de INSERT/DELETE em profiles, então
-- o RLS barra — mas se alguém criar uma policy de INSERT no futuro, viraria
-- escalação a admin. Removendo o grant, o risco não volta por acidente.
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;

-- ------------------------------------------------------------
-- F-12 — grants excessivos em todo o schema
-- TRUNCATE não é filtrado por RLS. REFERENCES/TRIGGER nunca são necessários
-- para o cliente. Nada disso é exposto pelo PostgREST hoje.
-- ------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- F-11 (views SECURITY DEFINER) ficou FORA deste lote de propósito:
-- security_invoker = on pode fazer as telas retornarem menos linhas, então
-- exige teste manual. Vai no Lote 2.

-- ============================================================
-- ROLLBACK (só se algo quebrar; reabre os buracos, use com critério)
-- ============================================================
-- GRANT EXECUTE ON FUNCTION public.add_to_balance(uuid, numeric) TO anon, authenticated;
-- CREATE POLICY outcomes_service_write ON public.topic_outcomes FOR ALL USING (true);
-- CREATE POLICY desafios_update_service ON public.desafios FOR UPDATE USING (true);
-- CREATE POLICY desafio_bets_update_service ON public.desafio_bets FOR UPDATE USING (true);
-- GRANT SELECT ON public.profiles TO anon;
