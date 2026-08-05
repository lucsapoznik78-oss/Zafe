-- 072 — tira as colunas de dinheiro de `bets` do alcance da chave anônima.
--
-- Contexto: a policy `bets_own_read` é
--   USING (auth.uid() = user_id OR is_private = false)
-- Sem sessão, `auth.uid()` é null, então o visitante anônimo enxerga
-- exatamente os palpites públicos — hoje 140 de 147. As 7 linhas
-- `is_private = true` já ficam fora, e isso está correto.
--
-- O que ainda não estava certo: dessas 140 linhas o anônimo lia TODAS as
-- colunas, incluindo `amount`, `potential_payout` e `cost_basis`. Cruzando
-- com `profiles.username`, que é público, dava para montar o histórico
-- financeiro nominal de qualquer usuário sem login.
--
-- Levantamento dos leitores reais de `bets` antes de revogar:
--
--   /historico ................ createClient() → anon. Único caminho
--                               verdadeiramente anônimo. Lê apenas
--                               `topic_id, user_id` onde status = 'won',
--                               e só para contar vencedores distintos.
--   /ranking, /u/[username],
--   /api/landing/atividade .... createAdminClient() → service_role, ignora
--                               RLS e grant. Não são afetados.
--   /api/topicos/[id]/chart ... createClient() com sessão → role
--                               `authenticated`. Lê `amount`. Por isso a
--                               revogação é só de `anon`.
--
-- Nenhum componente de browser lê `bets` direto, e não há canal de Realtime
-- na tabela — então não existe leitor anônimo fora do /historico.
--
-- Grant de coluna e não policy nova, pelo mesmo motivo do lockdown de
-- `profiles` (042): grant é avaliado antes da policy e independe do `USING`.
-- Um edit futuro que afrouxe `bets_own_read` não reabre estas colunas.
--
-- Reversível: `GRANT SELECT (coluna) ON bets TO anon`.

REVOKE SELECT (
  amount,
  gross_amount,
  matched_amount,
  unmatched_amount,
  potential_payout,
  locked_odds,
  cost_basis
) ON public.bets FROM anon;
