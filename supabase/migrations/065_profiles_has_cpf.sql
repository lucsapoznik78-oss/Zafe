-- 065 — coluna gerada `profiles.has_cpf` (preparação para o lote 7 / audit F-06)
--
-- O middleware precisa saber APENAS se o usuário já preencheu o CPF, para
-- decidir o gate de /completar-cadastro. Hoje ele lê a coluna `cpf` inteira com
-- o client do usuário — e como a policy de leitura de `profiles` é
-- `USING (true)`, manter o SELECT de `cpf` para `authenticated` significa que
-- QUALQUER usuário logado lê o CPF de todo mundo pelo PostgREST.
--
-- Esta coluna gerada expõe só o booleano, para que a migration 066 possa
-- revogar `cpf` (e o resto da PII) sem quebrar o middleware. Ela é STORED e
-- derivada, então não há como dessincronizar de `cpf`.
--
-- Aditiva e reversível: nada quebra por aplicá-la antes do deploy do código.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_cpf boolean
  GENERATED ALWAYS AS (cpf IS NOT NULL) STORED;

-- Só `authenticated`: o middleware só consulta o perfil quando há sessão.
GRANT SELECT (has_cpf) ON public.profiles TO authenticated;

-- ROLLBACK:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS has_cpf;
