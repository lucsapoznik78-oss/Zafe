-- ============================================================
-- ZAFE — Migration 046: Zafe Games — expansão de jogos + eventos de usuário
-- ============================================================
-- 1. Amplia o catálogo de jogos (FIFA/EA FC, Fortnite, GTA, Clash Royale, etc).
-- 2. Permite eventos criados POR USUÁRIOS (estilo Comunidade): coluna
--    creator_id. NULL = evento oficial (admin/cron). Eventos de usuário são
--    SEMPRE modo grátis (só pontos) — a constraint games_event_mode_buyin já
--    garante buy_in = 0 no modo 'free', então nenhum Z$ toca eventos de
--    usuário (sem auto-negociação de pote). Modo pote continua admin-only.
--
-- COMPLIANCE (modules/games/COMPLIANCE.md): segue valendo — sem mercado
-- público, sem order book, palpite fecha antes do jogo (closes_at <= starts_at).

-- ------------------------------------------------------------
-- 1. Catálogo de jogos ampliado
-- ------------------------------------------------------------
ALTER TABLE games_event DROP CONSTRAINT IF EXISTS games_event_game_check;
ALTER TABLE games_event ADD CONSTRAINT games_event_game_check CHECK (game IN (
  'free_fire','valorant','cs2','lol',
  'ea_fc','fortnite','gta','clash_royale',
  'rocket_league','dota2','pubg','codm','r6'
));

-- ------------------------------------------------------------
-- 2. Eventos criados por usuários (NULL = oficial admin/cron)
-- ------------------------------------------------------------
ALTER TABLE games_event
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_event_creator ON games_event(creator_id)
  WHERE creator_id IS NOT NULL;

-- Defesa em profundidade: evento de usuário (creator_id não nulo) só pode ser
-- modo grátis. O pote (Z$) permanece exclusivo de eventos oficiais.
ALTER TABLE games_event DROP CONSTRAINT IF EXISTS games_event_user_free_only;
ALTER TABLE games_event ADD CONSTRAINT games_event_user_free_only CHECK (
  creator_id IS NULL OR mode = 'free'
);
