-- 071 — valor `admin_alert` no enum notification_type.
--
-- Motivo: o alerta diário de rate limit (lib/ratelimit-alerta.ts, chamado de
-- carona no cron /api/cron/ranking-delta) precisa notificar os admins quando o
-- volume de bloqueios cruza o limiar ou quando o Redis derrubou escritas de
-- dinheiro. Sem um valor próprio o alerta teria que se disfarçar de
-- `market_resolved` ou `bonus`, o que polui o feed do usuário e torna
-- impossível filtrar depois.
--
-- Idempotente: IF NOT EXISTS. Só adiciona um rótulo — nenhuma linha existente
-- muda, e nada passa a gravar este valor exceto o alerta.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_alert';
