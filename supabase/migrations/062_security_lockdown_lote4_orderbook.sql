-- ============================================================
-- ZAFE — Migration 062: lockdown de segurança, Lote 4 (order book)
-- ============================================================
-- Achado F-10 da auditoria de 24/07/2026. Diferente dos lotes 2 e 3, aqui
-- NENHUMA mudança de código é necessária: todo acesso a orders/trades no repo
-- já passa por createAdminClient() (lib/order-matching.ts, /api/cron/match-orders,
-- /api/topicos/[id]/{orderbook,ordem,ordem/[orderId]}, app/admin/page.tsx,
-- app/(main)/portfolio/page.tsx). Nenhum componente de browser lê ou escreve
-- estas tabelas, e a única subscription de Realtime do app é em `comments`.
-- Logo esta migration pode ser aplicada sem deploy prévio.
--
-- O que estava explorável:
--
-- 1. orders INSERT/UPDATE — as policies checavam `user_id = auth.uid()`, ou seja
--    barravam mexer na ordem de OUTRO, mas não impediam o dono de escrever
--    direto no PostgREST e pular a rota. /api/topicos/[id]/ordem valida saldo,
--    preço e status do evento antes de inserir; um POST direto criava ordem sem
--    nada disso. Pior, `orders_update` permitia dar PATCH na própria ordem
--    depois de criada: mudar `price` já sabendo como o mercado andou, inflar
--    `quantity`, reabrir uma ordem `cancelled` ou forjar `filled_qty`.
--
-- 2. orders_desafio_read — `USING (desafio_id IS NOT NULL OR topic_id IS NOT
--    NULL)` é verdadeiro para toda linha com qualquer um dos dois preenchidos,
--    isto é, todas. Como policies permissivas se somam com OR, ela anulava o
--    escopo de `orders_select` e expunha o livro inteiro de todo mundo, em
--    qualquer status (`filled`, `cancelled`), não só as ordens abertas que a
--    tela precisa. Fica só `orders_select`, que mostra open/partial de todos
--    (o livro público) mais as próprias ordens do usuário.
--
-- 3. desafio_bets INSERT — o mais grave em termos de Z$: a policy só exigia
--    `auth.uid() = user_id`, então dava para inserir o próprio palpite sem
--    passar por nenhum débito de carteira. Palpite de graça.
--
-- 4. desafios INSERT — criar evento fugindo da validação de categoria
--    (Art. 49) e de `closes_at` que as rotas fazem.
--
-- 5. trades INSERT/UPDATE/DELETE — os GRANTs existiam mas a tabela só tem
--    policy de SELECT, e sem policy o RLS já negava a escrita. Eram grants
--    mortos; revogados aqui só para o catálogo parar de mentir sobre a
--    superfície de ataque.
--
-- O caminho legítimo de escrita continua intacto: `execute_trade` é
-- SECURITY DEFINER e já tem EXECUTE apenas para postgres e service_role
-- (verificado em pg_proc.proacl), então grava trades/desafio_bets/bets por
-- dentro, sem depender destes GRANTs.
--
-- Estado das tabelas na aplicação: desafios=1 linha, desafio_bets=0, trades=0,
-- orders=5. O módulo `desafios` é vestigial (nenhum arquivo .ts/.tsx faz
-- `.from("desafios")`), mas as tabelas NÃO são removidas aqui.

-- ------------------------------------------------------------
-- orders — livro de ofertas
-- ------------------------------------------------------------
DROP POLICY IF EXISTS orders_desafio_insert ON public.orders;
DROP POLICY IF EXISTS orders_insert         ON public.orders;
DROP POLICY IF EXISTS orders_desafio_update ON public.orders;
DROP POLICY IF EXISTS orders_update         ON public.orders;
-- leitura: derruba só a policy ampla demais; orders_select permanece.
DROP POLICY IF EXISTS orders_desafio_read   ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;

-- ------------------------------------------------------------
-- trades — execuções (grants mortos: sem policy de escrita)
-- ------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.trades FROM anon, authenticated;

-- ------------------------------------------------------------
-- desafios / desafio_bets
-- desafios_creator_update também é policy morta (UPDATE nunca foi concedido).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS desafios_authenticated_insert ON public.desafios;
DROP POLICY IF EXISTS desafios_insert_auth          ON public.desafios;
DROP POLICY IF EXISTS desafios_creator_update       ON public.desafios;
REVOKE INSERT, UPDATE, DELETE ON public.desafios FROM anon, authenticated;

DROP POLICY IF EXISTS desafio_bets_authenticated_insert ON public.desafio_bets;
DROP POLICY IF EXISTS desafio_bets_insert_auth          ON public.desafio_bets;
REVOKE INSERT, UPDATE, DELETE ON public.desafio_bets FROM anon, authenticated;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- GRANT INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
-- CREATE POLICY orders_insert ON public.orders
--   FOR INSERT WITH CHECK (user_id = auth.uid());
-- CREATE POLICY orders_desafio_insert ON public.orders
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND desafio_id IS NOT NULL);
-- CREATE POLICY orders_update ON public.orders
--   FOR UPDATE USING (user_id = auth.uid());
-- CREATE POLICY orders_desafio_update ON public.orders
--   FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true));
-- CREATE POLICY orders_desafio_read ON public.orders
--   FOR SELECT USING (desafio_id IS NOT NULL OR topic_id IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.trades TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON public.desafios TO anon, authenticated;
-- CREATE POLICY desafios_insert_auth ON public.desafios
--   FOR INSERT WITH CHECK (auth.uid() = creator_id);
-- CREATE POLICY desafios_authenticated_insert ON public.desafios
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = creator_id);
-- CREATE POLICY desafios_creator_update ON public.desafios
--   FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true));
-- GRANT INSERT, UPDATE, DELETE ON public.desafio_bets TO anon, authenticated;
-- CREATE POLICY desafio_bets_insert_auth ON public.desafio_bets
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY desafio_bets_authenticated_insert ON public.desafio_bets
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
