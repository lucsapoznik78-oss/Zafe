-- ============================================================
-- ZAFE — Migration 063: lockdown de segurança, Lote 5 (ligas de amigos)
-- ============================================================
-- Último grupo do achado F-09 da auditoria de 24/07/2026. Impacto é social, não
-- monetário (ligas de amigos são só leaderboard), mas as policies eram do mesmo
-- tipo `auth.uid() IS NOT NULL` dos lotes anteriores:
--
--   - liga_members_insert  WITH CHECK (auth.uid() IS NOT NULL)
--     Qualquer logado inseria QUALQUER linha: entrar sozinho numa liga PRIVADA
--     sem convite, ou inscrever outra pessoa numa liga. A policy mais restrita
--     que existia ao lado (`liga_members_public_self_join`, que exigia
--     `user_id = auth.uid() AND is_liga_public(liga_id)`) não protegia nada,
--     porque policies permissivas se somam com OR — a frouxa vencia.
--
--   - ligas_creator_insert WITH CHECK (auth.uid() IS NOT NULL)
--     Criar liga com `creator_id` de outra pessoa.
--
--   - liga_members_update  USING (user_id = auth.uid() OR is_liga_creator(...))
--     Barra mexer na linha alheia, mas deixava o próprio membro dar PATCH na
--     sua: auto-aceitar um convite `pending` sem passar pela rota, ou reabrir
--     um `declined`.
--
-- PRÉ-REQUISITO DE CÓDIGO (mesmo commit): as 7 rotas que escreviam com o client
-- do usuário passaram a usar createAdminClient(), mantendo as checagens de dono
-- que já existiam:
--   - app/api/ligas/criar/route.ts            (ligas + liga_members)
--   - app/api/ligas/entrar/route.ts           (checa is_public = true)
--   - app/api/ligas/convidar/route.ts         (checa membro ativo)
--   - app/api/ligas/aceitar/route.ts          (escopado em user_id = user.id)
--   - app/api/ligas/sair/route.ts             (checa membro ativo e não-criador)
--   - app/api/ligas/recusar-convite/route.ts  (escopado em user_id + pending)
--   - app/api/ligas/transferir-admin/route.ts (checa criador atual)
-- /api/ligas/apagar já usava admin. Nenhum componente de browser escreve nestas
-- tabelas: app/(main)/amigos/page.tsx e privadas/criar/page.tsx só leem.
--
-- Ordem correta: deploy do código primeiro, migration depois.
--
-- BUG CORRIGIDO DE BRINDE: liga_members nunca teve policy de DELETE, então os
-- deletes de /sair e /recusar-convite eram negados pela RLS e as rotas
-- respondiam `success` sem apagar nada — sair de liga e recusar convite estavam
-- silenciosamente quebrados. Com service role passam a funcionar. Os GRANTs de
-- DELETE revogados aqui eram, portanto, grants mortos.
--
-- NENHUMA policy de SELECT é tocada. ligas_public_read, ligas_member_read,
-- ligas_invitee_read, ligas_subliga_member_read, liga_members_read,
-- liga_members_member_read e liga_members_public_liga_read continuam como
-- estão — as telas de /ligas e /amigos não mudam.

-- ------------------------------------------------------------
-- ligas
-- ------------------------------------------------------------
DROP POLICY IF EXISTS ligas_creator_insert ON public.ligas;
DROP POLICY IF EXISTS ligas_creator_update ON public.ligas;
REVOKE INSERT, UPDATE, DELETE ON public.ligas FROM anon, authenticated;

-- ------------------------------------------------------------
-- liga_members
-- ------------------------------------------------------------
DROP POLICY IF EXISTS liga_members_insert           ON public.liga_members;
DROP POLICY IF EXISTS liga_members_public_self_join ON public.liga_members;
DROP POLICY IF EXISTS liga_members_update           ON public.liga_members;
REVOKE INSERT, UPDATE, DELETE ON public.liga_members FROM anon, authenticated;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- GRANT INSERT, UPDATE, DELETE ON public.ligas TO anon, authenticated;
-- CREATE POLICY ligas_creator_insert ON public.ligas
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY ligas_creator_update ON public.ligas
--   FOR UPDATE USING (creator_id = auth.uid());
-- GRANT INSERT, UPDATE, DELETE ON public.liga_members TO anon, authenticated;
-- CREATE POLICY liga_members_insert ON public.liga_members
--   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY liga_members_public_self_join ON public.liga_members
--   FOR INSERT WITH CHECK (user_id = auth.uid() AND is_liga_public(liga_id));
-- CREATE POLICY liga_members_update ON public.liga_members
--   FOR UPDATE USING (user_id = auth.uid() OR is_liga_creator(liga_id));
