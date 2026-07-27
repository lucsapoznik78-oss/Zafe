-- ============================================================
-- ZAFE — Migration 061: lockdown de segurança, Lote 3 (integridade do evento)
-- ============================================================
-- Achado F-09 da auditoria de 24/07/2026: 9 policies de escrita usavam
-- `auth.uid() IS NOT NULL`, que só pergunta "existe alguém logado?" e não
-- "este registro é seu?". Somado ao GRANT de UPDATE em todas as colunas, dava
-- para qualquer usuário logado escrever na linha de qualquer outro.
--
-- O caso mais grave era `topics`: com PATCH /rest/v1/topics um logado alterava
-- QUALQUER evento, incluindo `status`, `resolution` e `closes_at`. O exploit
-- prático é esticar o `closes_at` de um evento cujo resultado do mundo real já
-- é conhecido e palpitar com certeza — ou cancelar/resolver evento alheio.
--
-- PRÉ-REQUISITO DE CÓDIGO (já aplicado no mesmo commit): toda escrita nestas
-- tabelas passou a usar createAdminClient(), mantendo as checagens de dono que
-- já existiam nas rotas. Rotas alteradas:
--   - app/api/criar/route.ts                                  (topics INSERT)
--   - app/api/topicos/[id]/editar/route.ts                    (topics UPDATE)
--   - app/api/apostas-privadas/[id]/votar-lider/route.ts      (topic_sides, topics)
--   - app/api/apostas-privadas/[id]/juizes/responder/route.ts (judge_nominations)
--   - app/api/apostas-privadas/[id]/juizes/disponibilidade/route.ts
-- As duas últimas também corrigem um bug do mesmo tipo do de aceitar-aposta: as
-- notificações para o juiz e para os líderes eram inseridas com o client do
-- usuário, e o RLS de notifications barra inserir para outro user_id.
-- Os demais caminhos (crons, /api/admin/*, /api/apostas-privadas/{criar,
-- aceitar,convidar,recusar,cancelar,votar-resultado}) já usavam admin.
--
-- Ordem correta: deploy do código primeiro, migration depois.
--
-- NENHUMA policy de SELECT é tocada aqui. topics_public_read,
-- topics_select_private_members, "Membros veem nomeacoes", "Participantes veem
-- lados", "Membros veem participantes", snapshots_public_read e
-- bet_matches_read continuam como estão — as telas não mudam.

-- ------------------------------------------------------------
-- topics — resultado, prazo e status do evento (CRÍTICO)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS topics_authenticated_insert ON public.topics;
DROP POLICY IF EXISTS topics_service_update       ON public.topics;
REVOKE INSERT, UPDATE, DELETE ON public.topics FROM anon, authenticated;

-- ------------------------------------------------------------
-- topic_sides / topic_participants / judge_nominations
-- Estas três decidem quem lidera, quem participa e quem julga uma privada —
-- ou seja, decidem o payout. jn_update permitia a qualquer logado aprovar-se
-- como juiz de uma aposta alheia.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS ts_insert ON public.topic_sides;
DROP POLICY IF EXISTS ts_update ON public.topic_sides;
REVOKE INSERT, UPDATE, DELETE ON public.topic_sides FROM anon, authenticated;

DROP POLICY IF EXISTS tp_insert ON public.topic_participants;
DROP POLICY IF EXISTS tp_update ON public.topic_participants;
REVOKE INSERT, UPDATE, DELETE ON public.topic_participants FROM anon, authenticated;

DROP POLICY IF EXISTS jn_insert ON public.judge_nominations;
DROP POLICY IF EXISTS jn_update ON public.judge_nominations;
REVOKE INSERT, UPDATE, DELETE ON public.judge_nominations FROM anon, authenticated;

-- ------------------------------------------------------------
-- topic_snapshots / bet_matches — histórico e pareamento
-- Forjar snapshot falsifica o gráfico de probabilidade (que é a prova de como
-- o mercado estava na hora do palpite); forjar bet_match inventa pareamento.
-- Nenhuma rota escreve nestas duas com client de usuário — só cron e
-- /api/amigos/aceitar-aposta, ambos em service role.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS snapshots_service_insert ON public.topic_snapshots;
REVOKE INSERT, UPDATE, DELETE ON public.topic_snapshots FROM anon, authenticated;

DROP POLICY IF EXISTS bet_matches_service_insert ON public.bet_matches;
REVOKE INSERT, UPDATE, DELETE ON public.bet_matches FROM anon, authenticated;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- GRANT INSERT, UPDATE, DELETE ON public.topics TO anon, authenticated;
-- CREATE POLICY topics_authenticated_insert ON public.topics
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY topics_service_update ON public.topics
--   FOR UPDATE USING (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.topic_sides TO anon, authenticated;
-- CREATE POLICY ts_insert ON public.topic_sides
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY ts_update ON public.topic_sides
--   FOR UPDATE USING (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.topic_participants TO anon, authenticated;
-- CREATE POLICY tp_insert ON public.topic_participants
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY tp_update ON public.topic_participants
--   FOR UPDATE USING (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.judge_nominations TO anon, authenticated;
-- CREATE POLICY jn_insert ON public.judge_nominations
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY jn_update ON public.judge_nominations
--   FOR UPDATE USING (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.topic_snapshots TO anon, authenticated;
-- CREATE POLICY snapshots_service_insert ON public.topic_snapshots
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- GRANT INSERT, UPDATE, DELETE ON public.bet_matches TO anon, authenticated;
-- CREATE POLICY bet_matches_service_insert ON public.bet_matches
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
