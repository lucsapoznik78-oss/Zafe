-- ============================================================
-- ZAFE — Migration 060: lockdown de segurança, Lote 2 (dinheiro)
-- ============================================================
-- Achados F-01, F-07, F-08 da auditoria de 24/07/2026.
--
-- PRÉ-REQUISITO DE CÓDIGO (já aplicado no mesmo commit): toda escrita em
-- wallets/bets/transactions passou a usar createAdminClient(). Rotas alteradas:
--   - app/api/apostar/route.ts
--   - app/api/liga/[id]/palpitar/route.ts
--   - app/api/amigos/aceitar-aposta/route.ts  (também corrige um bug: o RLS
--     barrava o débito da carteira do convidante, então aceitar convite de
--     palpite privado falhava sempre)
-- Os demais caminhos (crons, /api/admin/*, /api/apostas-privadas/*,
-- /api/comunidade/*, /api/topicos/*/ordem, order-matching) já usavam admin.
--
-- Sem o deploy do código acima, ESTA MIGRATION QUEBRA O PALPITE. Ordem correta:
-- deploy do código primeiro, migration depois.

-- ------------------------------------------------------------
-- F-01 — Carteira gravável pelo cliente (CRÍTICO)
-- wallets_own era FOR ALL USING (auth.uid() = user_id): restringia a LINHA,
-- mas não a COLUNA, e o grant de UPDATE em `balance` estava concedido. Qualquer
-- usuário logado dava PATCH /rest/v1/wallets e escrevia o saldo que quisesse.
-- Saldo é consequência de transação validada no servidor, não campo editável.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS wallets_own ON public.wallets;

CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
-- INSERT de carteira continua funcionando: quem cria é o trigger
-- handle_new_user() (SECURITY DEFINER), que não depende destes grants.

-- ------------------------------------------------------------
-- F-07 — Ledger de transações gravável pelo cliente (ALTO)
-- transactions_service_insert tinha WITH CHECK (auth.uid() IS NOT NULL): só
-- checava "existe alguém logado", não que o user_id fosse o do próprio usuário.
-- Qualquer autenticado forjava transação em nome de qualquer outro — e é
-- justamente esta tabela que se usaria para auditar fraude em F-01/F-02.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS transactions_service_insert ON public.transactions;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM anon, authenticated;
-- transactions_own (SELECT, auth.uid() = user_id) permanece: o usuário vê o
-- próprio extrato.

-- ------------------------------------------------------------
-- F-08 — Palpites alheios editáveis (ALTO)
-- bets_service_update USING (auth.uid() IS NOT NULL) permitia a qualquer
-- logado alterar valor, lado, status e payout do palpite de outra pessoa.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS bets_service_update ON public.bets;
DROP POLICY IF EXISTS bets_service_insert ON public.bets;
REVOKE INSERT, UPDATE, DELETE ON public.bets FROM anon, authenticated;
-- bets_own_read (SELECT: auth.uid() = user_id OR is_private = false) permanece.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
-- CREATE POLICY wallets_own ON public.wallets FOR ALL USING (auth.uid() = user_id);
-- GRANT INSERT, UPDATE, DELETE ON public.wallets TO anon, authenticated;
-- CREATE POLICY transactions_service_insert ON public.transactions
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- GRANT INSERT ON public.transactions TO anon, authenticated;
-- CREATE POLICY bets_service_insert ON public.bets
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY bets_service_update ON public.bets
--   FOR UPDATE USING (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE ON public.bets TO anon, authenticated;
