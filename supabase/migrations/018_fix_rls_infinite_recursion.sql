-- Corrige recursao infinita em RLS que derrubava a listagem de eventos.
-- topics_select_private_members consulta topic_participants, cuja policy
-- consultava topic_participants de novo -> recursao. ligas <-> liga_members
-- tinham recursao mutua. Solucao: funcoes SECURITY DEFINER que ignoram RLS.

-- == topic_participants ==
CREATE OR REPLACE FUNCTION public.is_topic_participant(p_topic_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM topic_participants
    WHERE topic_id = p_topic_id
      AND user_id = auth.uid()
      AND status = 'accepted'
  );
$$;

DROP POLICY IF EXISTS "Membros veem participantes" ON topic_participants;
CREATE POLICY "Membros veem participantes" ON topic_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_topic_participant(topic_id)
);

-- == ligas <-> liga_members ==
CREATE OR REPLACE FUNCTION public.is_liga_member(p_liga_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM liga_members
    WHERE liga_id = p_liga_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_liga_creator(p_liga_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ligas WHERE id = p_liga_id AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_liga_public(p_liga_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ligas WHERE id = p_liga_id AND is_public = true
  );
$$;

-- ligas: trocar subqueries em liga_members por funcao SECURITY DEFINER
DROP POLICY IF EXISTS "ligas_member_read" ON ligas;
CREATE POLICY "ligas_member_read" ON ligas FOR SELECT
USING (creator_id = auth.uid() OR public.is_liga_member(id));

DROP POLICY IF EXISTS "ligas_subliga_member_read" ON ligas;
CREATE POLICY "ligas_subliga_member_read" ON ligas FOR SELECT
USING (parent_liga_id IS NOT NULL AND public.is_liga_member(parent_liga_id));

-- liga_members: trocar subqueries em ligas por funcao SECURITY DEFINER
DROP POLICY IF EXISTS "liga_members_public_liga_read" ON liga_members;
CREATE POLICY "liga_members_public_liga_read" ON liga_members FOR SELECT
USING (public.is_liga_public(liga_id));

DROP POLICY IF EXISTS "liga_members_read" ON liga_members;
CREATE POLICY "liga_members_read" ON liga_members FOR SELECT
USING (
  user_id = auth.uid()
  OR invited_by = auth.uid()
  OR public.is_liga_creator(liga_id)
);

DROP POLICY IF EXISTS "liga_members_update" ON liga_members;
CREATE POLICY "liga_members_update" ON liga_members FOR UPDATE
USING (user_id = auth.uid() OR public.is_liga_creator(liga_id));

DROP POLICY IF EXISTS "liga_members_public_self_join" ON liga_members;
CREATE POLICY "liga_members_public_self_join" ON liga_members FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_liga_public(liga_id));
