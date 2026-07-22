-- Adiciona 'cancelado' aos status válidos de concursos.
-- Motivo: precisamos poder cancelar um concurso sem pagar prêmio (caso do
-- concurso Junho 2026 — cancelado após a virada do mês). Antes só existia
-- agendado/ativo/apurando/pago, o que forçava marcar como 'pago' (mentira)
-- ou deixar em 'apurando' pra sempre.

ALTER TABLE concursos DROP CONSTRAINT IF EXISTS concursos_status_check;
ALTER TABLE concursos
  ADD CONSTRAINT concursos_status_check
  CHECK (status = ANY (ARRAY['agendado','ativo','apurando','pago','cancelado']::text[]));
