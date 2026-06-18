-- ============================================================
-- ZAFE — Migration 044: chat dos eventos da comunidade (Premium)
-- ============================================================
-- Chat exclusivo para membros Zafe Premium em cada evento da Comunidade.
-- Leitura e escrita são restritas a premium — o gate fica na API
-- (app/api/comunidade/[id]/chat), que valida isPremium() e usa o service
-- role para ler/gravar. RLS habilitada SEM policy de SELECT/INSERT, espelhando
-- o padrão de topic_insights: só o service_role acessa; a anon/auth key não
-- alcança as mensagens diretamente (não-premium veem só a prévia bloqueada).

CREATE TABLE IF NOT EXISTS community_event_chat (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_chat_event
  ON community_event_chat(event_id, created_at);

ALTER TABLE community_event_chat ENABLE ROW LEVEL SECURITY;
-- Sem policy = negado para anon/authenticated. Todo acesso passa pelo
-- service role na API, que valida o tier Premium antes de ler/gravar.
