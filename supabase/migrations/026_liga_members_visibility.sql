-- Visibilidade de grupos privados (ligas)
--
-- Problema: um membro ativo de um grupo privado só conseguia ver a própria
-- linha em liga_members (políticas: user_id = auth.uid() OR invited_by = auth.uid()
-- OR is_liga_creator). Isso fazia o card mostrar "1 membros" e uma lista de
-- membros incompleta, parecendo um grupo quebrado/duplicado.
--
-- Além disso, um convidado pendente precisa conseguir ler a linha de `ligas`
-- (nome, cor) para o card de convite aparecer — sem por isso ver o grupo na
-- lista de grupos (que filtra status='active').

-- Convidado (qualquer vínculo) pode ler a liga para renderizar o convite.
CREATE OR REPLACE FUNCTION public.is_liga_invitee(p_liga_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM liga_members
    WHERE liga_id = p_liga_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS ligas_invitee_read ON public.ligas;
CREATE POLICY ligas_invitee_read ON public.ligas
  FOR SELECT USING (is_liga_invitee(id));

-- Membro ATIVO pode ver todos os co-membros do grupo (is_liga_member exige
-- status='active'; SECURITY DEFINER, sem recursão de RLS).
DROP POLICY IF EXISTS liga_members_member_read ON public.liga_members;
CREATE POLICY liga_members_member_read ON public.liga_members
  FOR SELECT USING (is_liga_member(liga_id));
