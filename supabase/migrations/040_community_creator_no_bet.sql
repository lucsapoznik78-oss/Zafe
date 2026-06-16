-- Impede que o criador de um evento da comunidade palpite no próprio evento.
-- O criador é quem resolve o evento (sistema criador + contestação), então
-- palpitar seria conflito de interesse — poderia resolver a favor do próprio
-- palpite. A checagem já existe na aplicação (lib/comunidade.ts), este trigger
-- é defesa em profundidade para qualquer outro caminho de escrita.

CREATE OR REPLACE FUNCTION enforce_community_creator_no_bet()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM community_events ce
    WHERE ce.id = NEW.event_id
      AND ce.creator_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'O criador do evento não pode palpitar no próprio evento';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_creator_no_bet ON community_bets;
CREATE TRIGGER trg_community_creator_no_bet
  BEFORE INSERT ON community_bets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_community_creator_no_bet();
