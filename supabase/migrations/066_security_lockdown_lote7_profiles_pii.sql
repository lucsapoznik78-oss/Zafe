-- 066 — Security lockdown, lote 7: PII de `profiles` (audit F-06)
--
-- O BURACO
-- A única policy de leitura de `profiles` é `profiles_public_read USING (true)`,
-- para todos os roles. Ela é necessária (perfil público, ranking, busca de
-- amigos), então a granularidade real é o GRANT POR COLUNA — e `authenticated`
-- tinha SELECT nas 29 colunas. Ou seja, bastava uma conta logada qualquer e um
-- GET em /rest/v1/profiles?select=cpf,phone,cep,... para baixar CPF, telefone,
-- data de nascimento e o ENDEREÇO COMPLETO de todos os usuários da base.
--
-- `anon` já estava correto desde antes (7 colunas públicas), então isto nunca
-- foi exposto sem login.
--
-- O QUE MUDA
-- `authenticated` perde SELECT de cpf, phone, birth_date e das 7 colunas de
-- endereço. Continua com o UPDATE dessas colunas (migration 042, escopado em
-- `auth.uid() = id`), então o usuário segue editando o próprio cadastro — só
-- não consegue mais LER o de ninguém, nem o dele. Onde o produto precisa
-- mostrar a PII do dono, a leitura passou a ser server-side com service role.
--
-- PRÉ-REQUISITO — já deployado (commit anterior a esta migration):
--   middleware.ts                        → lê `has_cpf` (coluna gerada, 065)
--   app/(auth)/completar-cadastro/page.tsx → createAdminClient()
--   app/(main)/perfil/page.tsx (select "*") → createAdminClient()
--   components/auth/LoginForm.tsx        → GET /api/auth/2fa-contexto
-- Todos os outros leitores de cpf/birth_date (concurso/entrar, reentrar,
-- inscrever, pagamento/criar, kyc, perfil/completar, admin, concurso-pagamento)
-- já usavam `admin`, inclusive nos filtros `.eq("cpf", ...)` de unicidade —
-- filtro também exige o privilégio de SELECT na coluna.

-- ARMADILHA: `authenticated` tinha um GRANT SELECT de TABELA, e no Postgres o
-- privilégio de tabela implica todas as colunas — um `REVOKE SELECT (cpf)` em
-- cima dele é silenciosamente inócuo (foi o que aconteceu na primeira tentativa
-- desta migration: o catálogo continuou listando as 29 colunas). É preciso
-- derrubar o grant de tabela e re-conceder coluna a coluna, que é justamente
-- como o `anon` já estava. Por isso o lista-branca abaixo em vez de um REVOKE.

REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id,
  username,
  full_name,
  avatar_url,
  created_at,
  updated_at,
  referral_code,
  referred_by,
  is_premium,
  premium_until,
  is_admin,
  banned,
  kyc_verified,
  has_cpf,
  self_excluded_until,
  cooloff_until,
  terms_accepted_at,
  terms_version,
  two_fa_enabled,
  two_fa_method
) ON public.profiles TO authenticated;

-- ROLLBACK:
-- GRANT SELECT ON public.profiles TO authenticated;
