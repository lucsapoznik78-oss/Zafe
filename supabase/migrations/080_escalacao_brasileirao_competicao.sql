-- 080_escalacao_brasileirao_competicao.sql
--
-- Cria a competição Brasileirão no cadastro de competições da Escalação.
--
-- Ruleset usado: futebol.v1 (agregacaoMes = 'soma', stats individuais). O manual
-- não é específico da Champions — a soma por rodada serve para pontos corridos
-- direto, então não precisa de futebol.v2 (que o T5 bloquearia UPDATE mesmo).
--
-- teto_titulares = 3: mesma restrição da Champions. Dois campeonatos de futebol
-- competindo pelo mesmo teto de esporte não pode virar time inteiro de futebol.

insert into public.escalacao_competicao
  (slug, nome, esporte_key, modo, teto_titulares, ativo)
values
  ('brasileirao', 'Campeonato Brasileiro Série A', 'futebol', 'mix', 3, true)
on conflict (slug) do nothing;
