-- ============================================================
-- LIGAS — Grupos privados de investimento entre amigos
-- ============================================================

CREATE TABLE ligas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  description TEXT CHECK (char_length(description) <= 200),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#86efac',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE liga_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, user_id)
);

-- Adicionar liga_id aos tópicos
ALTER TABLE topics ADD COLUMN IF NOT EXISTS liga_id UUID REFERENCES ligas(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE ligas ENABLE ROW LEVEL SECURITY;
ALTER TABLE liga_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ligas_member_read" ON ligas FOR SELECT
  USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM liga_members WHERE liga_id = ligas.id AND user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "ligas_creator_insert" ON ligas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ligas_creator_update" ON ligas FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "liga_members_read" ON liga_members FOR SELECT
  USING (
    user_id = auth.uid() OR invited_by = auth.uid() OR
    EXISTS (SELECT 1 FROM ligas WHERE id = liga_id AND creator_id = auth.uid())
  );

CREATE POLICY "liga_members_insert" ON liga_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "liga_members_update" ON liga_members FOR UPDATE
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM ligas WHERE id = liga_id AND creator_id = auth.uid()));

-- Índices
CREATE INDEX idx_liga_members_liga_id ON liga_members(liga_id);
CREATE INDEX idx_liga_members_user_id ON liga_members(user_id);
CREATE INDEX idx_topics_liga_id ON topics(liga_id);
