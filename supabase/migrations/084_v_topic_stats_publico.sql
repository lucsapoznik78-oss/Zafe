-- 084_v_topic_stats_publico.sql
--
-- v_topic_stats vinha com security_invoker=true (hardening da Supabase). Isso
-- faz o RLS da tabela subjacente `bets` ser aplicado como se o chamador tivesse
-- pedido `bets` direto — como não existe policy para `anon`, sum(amount) volta
-- 0 pra todos os tópicos. Efeito colateral: na /liga, visitante deslogado
-- (Google/SEO) vê volume=0 pra tudo, o desempate colapsa em closes_at asc, e
-- eventos velhos sem palpite dominam o topo. Logado vê a ordem certa.
--
-- A view SÓ expõe agregados (volume_sim, volume_nao, total_volume, prob_sim,
-- prob_nao, bet_count) por tópico — nada pessoal (nem user_id, nem valor de
-- palpite individual). Rodar como owner (postgres, BYPASSRLS) é a exceção
-- desenhada pra esse caso: estatística pública precisa aparecer pra anon.
--
-- Ver também v_latest_topic_snapshots — snapshot já é público por natureza
-- (histórico de prob agregada) e não precisa desse ajuste se já não tiver.

alter view public.v_topic_stats set (security_invoker = false);
