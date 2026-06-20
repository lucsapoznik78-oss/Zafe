-- ============================================================
-- ZAFE — Migration 047: Zafe Games — jogo personalizado ("Outro")
-- ============================================================
-- Permite ao criador digitar o nome do jogo quando não está no catálogo.
-- Mantém o CHECK do banco intacto: game = 'outros' + custom_game (texto livre).

ALTER TABLE games_event DROP CONSTRAINT IF EXISTS games_event_game_check;
ALTER TABLE games_event ADD CONSTRAINT games_event_game_check CHECK (game IN (
  'free_fire','valorant','cs2','lol',
  'ea_fc','fortnite','gta','clash_royale',
  'rocket_league','dota2','pubg','codm','r6',
  'outros'
));

ALTER TABLE games_event ADD COLUMN IF NOT EXISTS custom_game TEXT;

-- game = 'outros' exige um nome digitado; os demais não usam custom_game.
ALTER TABLE games_event DROP CONSTRAINT IF EXISTS games_event_custom_game;
ALTER TABLE games_event ADD CONSTRAINT games_event_custom_game CHECK (
  game <> 'outros' OR (custom_game IS NOT NULL AND length(trim(custom_game)) > 0)
);
