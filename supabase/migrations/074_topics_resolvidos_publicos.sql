-- 074 — deixa os tópicos já resolvidos visíveis na página pública de histórico.
--
-- Achado durante a auditoria da leitura anônima de `bets`: `/historico` se
-- anuncia como "Transparência total — Todos os eventos resolvidos na Zafe.
-- Resultado público, auditável por qualquer pessoa" e renderizava
-- "0 Eventos resolvidos / 0 Vencedores únicos" para todo mundo.
--
-- Causa: `topics_public_read` era
--   USING (status = 'active' OR creator_id = auth.uid())
-- Assim que um evento sai de `active`, ele some para quem não o criou —
-- inclusive para usuários logados. Eram 191 tópicos resolvidos invisíveis.
-- Não é vazamento; é o contrário, e some com a única prova pública de que a
-- plataforma resolve o que abre.
--
-- `/historico` é a única página que lê `topics` pela chave anônima
-- (`createClient()`); `/liga`, `/ranking` e `/u/[username]` usam
-- `createAdminClient()` e por isso nunca acusaram o problema.
--
-- O predicado é ampliado só para `status = 'resolved' AND is_private = false`:
--   - `resolved` e não `cancelled`, porque a página lista apenas resolvidos e
--     cancelado não é resultado auditável;
--   - `is_private = false` porque existe 1 tópico privado resolvido, e quem
--     participou dele já enxerga pela `topics_select_private_members`.
--
-- Feito com ALTER POLICY em vez de uma policy nova: policies de SELECT são
-- OR-adas entre si, e empilhar mais uma com o mesmo propósito produz a mesma
-- duplicação que `concursos` já tem hoje (`concursos_select` e
-- `concursos_select_all`, ambas `USING (true)`).
--
-- Reversível: voltar o USING para `(status = 'active' OR creator_id = auth.uid())`.

ALTER POLICY topics_public_read ON public.topics
  USING (
    status = 'active'::topic_status
    OR (status = 'resolved'::topic_status AND is_private = false)
    OR creator_id = auth.uid()
  );
