-- ============================================================
-- ZAFE — Migration 068: Canal do Usuário (suporte usuário ↔ admin)
-- ============================================================
-- Conversas 1:1 entre um usuário e a equipe Zafe. O usuário abre uma
-- conversa em /canal e o admin responde em /admin/canal.
--
-- RLS habilitada SEM policy (mesmo padrão de community_event_chat, 044):
-- só o service_role alcança as tabelas. Todo acesso passa pelas APIs,
-- que validam dono da conversa (usuário) ou profiles.is_admin.

-- Novos tipos de notificação (ADD VALUE precisa vir fora de qualquer uso).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'support_reply';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'support_message';

CREATE TABLE IF NOT EXISTS support_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  -- aberto      = aguardando resposta da equipe
  -- respondido  = equipe já respondeu, aguardando o usuário
  -- fechado     = encerrado pelo admin (o usuário reabre ao escrever de novo)
  status          TEXT NOT NULL DEFAULT 'aberto'
                    CHECK (status IN ('aberto', 'respondido', 'fechado')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unread_user     BOOLEAN NOT NULL DEFAULT FALSE, -- resposta da equipe não lida
  unread_admin    BOOLEAN NOT NULL DEFAULT TRUE,  -- mensagem do usuário não lida
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_admin BOOLEAN NOT NULL DEFAULT FALSE,
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lista do usuário e da fila do admin, ambas ordenadas por atividade recente.
CREATE INDEX IF NOT EXISTS idx_support_threads_user
  ON support_threads(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_status
  ON support_threads(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread
  ON support_messages(thread_id, created_at);

ALTER TABLE support_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
-- Sem policy = negado para anon/authenticated. Acesso só via service role
-- nas rotas /api/canal/* (dono) e /api/admin/canal/* (is_admin).
