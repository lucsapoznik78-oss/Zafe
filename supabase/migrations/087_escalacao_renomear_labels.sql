-- ------------------------------------------------------------
-- 087 — Renomeia os rótulos de esporte/competição para uma linguagem que
-- não pressupõe que o usuário conhece as siglas norte-americanas. Só troca
-- o `nome` exibido; `key`/`slug` (identificadores) ficam intactos.
--
--   futebol      : "Futebol"                          (segue genérico — cobre
--                                                      Brasileirão E Champions)
--   nba          : "NBA"                → "Basquete"
--   nfl          : "NFL"                → "Futebol Americano"
--   brasileirao  : "Campeonato Brasileiro Série A"
--                                       → "Futebol Brasileiro"
--
-- Cards em aberto/rascunho também recebem o novo título — quem abriu o painel
-- do mês encontra "Futebol Americano — Setembro/2026" no lugar do antigo
-- "NFL — Setembro/2026". Cards já apurados ficam com o título histórico.
-- ------------------------------------------------------------

UPDATE public.escalacao_esporte SET nome = 'Basquete'          WHERE key = 'nba' AND nome <> 'Basquete';
UPDATE public.escalacao_esporte SET nome = 'Futebol Americano' WHERE key = 'nfl' AND nome <> 'Futebol Americano';

UPDATE public.escalacao_competicao SET nome = 'Basquete'          WHERE slug = 'nba'         AND nome <> 'Basquete';
UPDATE public.escalacao_competicao SET nome = 'Futebol Americano' WHERE slug = 'nfl'         AND nome <> 'Futebol Americano';
UPDATE public.escalacao_competicao SET nome = 'Futebol Brasileiro' WHERE slug = 'brasileirao' AND nome <> 'Futebol Brasileiro';

UPDATE public.escalacao_card
   SET titulo = REPLACE(titulo, 'NFL', 'Futebol Americano')
 WHERE status IN ('rascunho','aberto') AND titulo LIKE '%NFL%';

UPDATE public.escalacao_card
   SET titulo = REPLACE(titulo, 'NBA', 'Basquete')
 WHERE status IN ('rascunho','aberto') AND titulo LIKE '%NBA%';

UPDATE public.escalacao_card
   SET titulo = REPLACE(titulo, 'Brasileirão', 'Futebol Brasileiro')
 WHERE status IN ('rascunho','aberto') AND titulo LIKE '%Brasileirão%';
