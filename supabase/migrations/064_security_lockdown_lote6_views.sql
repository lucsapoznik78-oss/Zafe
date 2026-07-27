-- 064 — Security lockdown, lote 6: views SECURITY DEFINER (audit F-11)
--
-- CONTEXTO
-- As 3 views abaixo foram criadas sem `security_invoker`, então rodavam com os
-- privilégios do OWNER (postgres) em vez dos do leitor. Na prática isso significa
-- que uma view lida com a anon key executa o SELECT nas tabelas-base IGNORANDO a
-- RLS dessas tabelas — a view vira um túnel em volta de todo o hardening dos
-- lotes 1 a 5.
--
-- Além disso, as três carregavam `GRANT INSERT, UPDATE, DELETE` para anon e
-- authenticated (default do Supabase). Nenhuma delas é auto-updatable (todas têm
-- agregação/GROUP BY), então o Postgres recusaria a escrita de qualquer forma —
-- mas o grant é ruído que faz o catálogo parecer bem mais permissivo do que é, e
-- passaria a ser um buraco de verdade se alguém redefinisse a view sem agregação.
--
-- POR QUE NÃO PRECISA DE DEPLOY DE CÓDIGO ANTES
-- Grep do repo: todos os leitores das 3 views usam `createAdminClient()`
-- (service_role), que tem BYPASSRLS e portanto não se importa com
-- `security_invoker`. Verificado caller a caller:
--   v_concurso_ranking       → components/concurso/RankingList.tsx (admin),
--                              app/api/concurso/ranking/route.ts (admin),
--                              app/api/cron/finalizar-concurso/route.ts (admin)
--   v_community_event_stats  → app/(main)/comunidade/page.tsx (admin),
--                              app/(main)/comunidade/[id]/page.tsx (admin),
--                              app/api/comunidade/[id]/apagar/route.ts (admin),
--                              app/api/cron/comunidade-snapshots/route.ts (admin),
--                              lib/comunidade.ts:112,158 — recebe o client por
--                              parâmetro, e o único caller (palpitar/route.ts:13)
--                              passa `admin`. Coerente com lib/comunidade.ts:147,
--                              que insere em `transactions` (service-role-only
--                              desde a migration 060) — um client de usuário ali
--                              já estaria quebrado.
--   v_desafio_stats          → ZERO referências no código. Vestigial, junto com o
--                              resto do módulo `desafios`.
-- Ou seja: mudança sem efeito nenhum na UI, e fecha os 3 últimos advisors ERROR
-- `security_definer_view`.

ALTER VIEW public.v_community_event_stats SET (security_invoker = on);
ALTER VIEW public.v_desafio_stats         SET (security_invoker = on);
ALTER VIEW public.v_concurso_ranking      SET (security_invoker = on);

REVOKE INSERT, UPDATE, DELETE ON public.v_community_event_stats FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.v_desafio_stats         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.v_concurso_ranking      FROM anon, authenticated;

-- ROLLBACK (se alguma tela server-side passar a ler com client de usuário e vier
-- vazia, o culpado é o security_invoker — mas a correção certa é trocar o client
-- por admin, não reabrir a view):
--
-- ALTER VIEW public.v_community_event_stats SET (security_invoker = off);
-- ALTER VIEW public.v_desafio_stats         SET (security_invoker = off);
-- ALTER VIEW public.v_concurso_ranking      SET (security_invoker = off);
-- GRANT INSERT, UPDATE, DELETE ON public.v_community_event_stats TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON public.v_desafio_stats         TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON public.v_concurso_ranking      TO anon, authenticated;
