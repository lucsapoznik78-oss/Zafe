-- 086_perfil_figura.sql
--
-- Adiciona a coluna `figura` em profiles: o avatar-personagem estilo Bitmoji/FIFA
-- que o usuário monta em /perfil. Guardamos SÓ a semente e as opções escolhidas
-- (seed, estilo, cores, cabelo, roupa…) — o SVG é gerado no client via DiceBear
-- a cada render, então nada de armazenar bytes de imagem. JSONB pra não travar
-- schema enquanto o builder ainda está ganhando opções.
--
-- Nullable de propósito: perfil sem figura ainda existe e cai no fallback de
-- iniciais na Navbar/PerfilTabs. Preencher é opt-in.
--
-- Shape esperado (validado no POST /api/perfil/figura, não no banco):
--   {
--     "seed":       "abc123",           -- string curta, determina base
--     "estilo":     "avataaars",         -- coleção do DiceBear (whitelist no server)
--     "skinColor":  "#f2d3b1",           -- hex
--     "hair":       "shortHairShortFlat",-- opção do estilo
--     "hairColor":  "#2c1b18",
--     "top":        "shirtCrewNeck",
--     "topColor":   "#4a9eff",
--     "accessories":"prescription02",     -- opcional
--     "facialHair": "beardMedium"         -- opcional
--   }
-- Campos extra ignorados. Isso permite ampliar o builder sem migration nova.

alter table public.profiles
  add column if not exists figura jsonb;

comment on column public.profiles.figura is
  'Configuração do avatar-personagem do usuário (DiceBear). Ver 086_perfil_figura.sql.';
