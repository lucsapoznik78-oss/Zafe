-- 073 — conserta a 072, que não teve efeito nenhum.
--
-- A 072 fez `REVOKE SELECT (colunas) ON bets FROM anon` e o `anon` continuou
-- lendo `amount` e `potential_payout` normalmente. Motivo: `bets` tinha SELECT
-- concedido no nível da TABELA (`relacl` = `anon=rm/postgres`). Em Postgres um
-- grant de tabela cobre todas as colunas, inclusive as que forem criadas
-- depois, e um revoke de coluna não abre buraco nele — o privilégio de tabela
-- continua valendo por si. Revoke de coluna só morde quando o acesso vem de
-- grants de coluna.
--
-- É por isso que `profiles` aparece como `anon=m/postgres`: a 042 derrubou o
-- SELECT de tabela e reconcedeu coluna a coluna. Mesmo padrão aqui.
--
-- Colunas mantidas para `anon` e por quê:
--   topic_id, user_id ... /historico conta vencedores distintos por tópico.
--                         É o único leitor de fato anônimo de `bets`.
--   id, side, status,
--   is_private,
--   created_at,
--   outcome_id ......... sem valor monetário; ficam para não engessar as
--                        páginas públicas de leitura.
--
-- Fora: amount, gross_amount, matched_amount, unmatched_amount,
-- potential_payout, locked_odds, cost_basis. Cruzadas com `profiles.username`,
-- que é público, essas colunas davam o histórico financeiro nominal de
-- qualquer usuário sem login.
--
-- `authenticated` não é tocado: /api/topicos/[id]/chart lê `amount` com a
-- sessão do usuário, e /ranking, /u/[username] e /api/landing/atividade usam
-- service_role, que ignora RLS e grant.
--
-- Efeito colateral esperado: `select=*` em `bets` passa a dar 401 para `anon`,
-- como já acontece em `profiles`. Nenhum caminho anônimo do app usa `*`.
--
-- Reversível: `GRANT SELECT ON public.bets TO anon`.

REVOKE SELECT ON public.bets FROM anon;

GRANT SELECT (
  id,
  topic_id,
  user_id,
  side,
  status,
  is_private,
  created_at,
  outcome_id
) ON public.bets TO anon;
