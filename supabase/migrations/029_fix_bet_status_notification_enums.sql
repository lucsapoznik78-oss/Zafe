-- ============================================================
-- ZAFE — Migration 029: enum values que o código já usa (audit N1 + N3)
-- ============================================================
-- N1 (CRITICAL): lib/order-matching.ts marca a aposta do vendedor como
-- status='exited' quando a posição é vendida por inteiro no mercado
-- secundário, mas o enum bet_status (001) não tinha esse valor — todo trade
-- que consumia a posição inteira estourava constraint e quebrava o matching.
--
-- N3 (HIGH): lib/order-matching.ts insere notificações type='trade_executed';
-- sem o valor no enum, o Promise.allSettled engolia o erro e a notificação
-- nunca era criada.
--
-- Aditiva e idempotente (ADD VALUE IF NOT EXISTS). Os novos valores não são
-- usados nesta mesma transação, então é seguro rodar num único batch.

ALTER TYPE bet_status ADD VALUE IF NOT EXISTS 'exited';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trade_executed';
