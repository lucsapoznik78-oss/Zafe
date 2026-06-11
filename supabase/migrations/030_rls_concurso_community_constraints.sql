-- ============================================================
-- ZAFE — Migration 030: RLS nas tabelas sem proteção + constraints ZC$
-- (audit N2 CRITICAL + N5 + N19)
-- ============================================================
-- N2: as tabelas criadas em 005 (concurso) e 021 (comunidade/push/referrals/
-- desafios) nunca habilitaram RLS. As escritas passam pelo service role
-- (que ignora RLS), mas qualquer query com a anon key alcançava saldos ZC$,
-- dados de inscrição e endpoints de push sem restrição.
--
-- Princípios:
--  * Escritas continuam exclusivas do service role (sem policy = negado),
--    EXCETO push_subscriptions e referrals, que o código grava com o client
--    do usuário (app/api/push/*, app/api/referral/registrar).
--  * Leituras: dados públicos (concursos, eventos da comunidade, reputação,
--    snapshots, contestações) liberados; dados por usuário (carteiras ZC$,
--    palpites, inscrições, push, referrals) restritos ao dono.
--  * Verificado: nenhuma página/rota lê essas tabelas com o client do
--    usuário além de perfil (referrals) e push/* — o resto é admin client.
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.

-- ── Concurso ────────────────────────────────────────────────────
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concursos_select_all ON concursos;
CREATE POLICY concursos_select_all ON concursos
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE inscricoes_concurso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inscricoes_select_own ON inscricoes_concurso;
CREATE POLICY inscricoes_select_own ON inscricoes_concurso
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE concurso_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concurso_wallets_select_own ON concurso_wallets;
CREATE POLICY concurso_wallets_select_own ON concurso_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE concurso_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concurso_bets_select_own ON concurso_bets;
CREATE POLICY concurso_bets_select_own ON concurso_bets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Comunidade (conteúdo público; palpites visíveis a logados) ──
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_events_select_all ON community_events;
CREATE POLICY community_events_select_all ON community_events
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE community_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_bets_select_auth ON community_bets;
CREATE POLICY community_bets_select_auth ON community_bets
  FOR SELECT TO authenticated USING (true);

ALTER TABLE community_contestations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_contestations_select_auth ON community_contestations;
CREATE POLICY community_contestations_select_auth ON community_contestations
  FOR SELECT TO authenticated USING (true);

ALTER TABLE community_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_snapshots_select_all ON community_snapshots;
CREATE POLICY community_snapshots_select_all ON community_snapshots
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE creator_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_reputation_select_all ON creator_reputation;
CREATE POLICY creator_reputation_select_all ON creator_reputation
  FOR SELECT TO anon, authenticated USING (true);

-- ── Push subscriptions (CRUD do próprio usuário via user client) ─
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subs_select_own ON push_subscriptions;
CREATE POLICY push_subs_select_own ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_insert_own ON push_subscriptions;
CREATE POLICY push_subs_insert_own ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_update_own ON push_subscriptions;
CREATE POLICY push_subs_update_own ON push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS push_subs_delete_own ON push_subscriptions;
CREATE POLICY push_subs_delete_own ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Referrals (perfil lê como referrer; registrar insere como referred) ─
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referrals_select_own ON referrals;
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());
DROP POLICY IF EXISTS referrals_insert_as_referred ON referrals;
CREATE POLICY referrals_insert_as_referred ON referrals
  FOR INSERT TO authenticated WITH CHECK (referred_id = auth.uid());

-- ── Desafios ────────────────────────────────────────────────────
ALTER TABLE desafio_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desafio_bets_select_own ON desafio_bets;
CREATE POLICY desafio_bets_select_own ON desafio_bets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── N5: ZC$ nunca negativo (espelha wallets da 001) ─────────────
DO $$ BEGIN
  ALTER TABLE concurso_wallets
    ADD CONSTRAINT concurso_wallets_balance_nonneg CHECK (balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── N19: coluna version + trigger (espelha migration 023) ───────
ALTER TABLE concurso_wallets ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS trg_bump_concurso_wallet_version ON concurso_wallets;
CREATE TRIGGER trg_bump_concurso_wallet_version
  BEFORE UPDATE ON concurso_wallets
  FOR EACH ROW
  EXECUTE FUNCTION bump_wallet_version();
