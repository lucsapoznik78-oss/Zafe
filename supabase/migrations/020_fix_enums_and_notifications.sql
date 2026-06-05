-- 020 — Reconcile enums + notifications schema with application code.
-- Fixes audit C3 (enum values the code inserts but the DB never defined → every
-- such INSERT errored at runtime) and C4 (the notifications table only had
-- `payload`, but ~28 call sites insert `title`/`body`/`data`, so social/bonus
-- notifications silently failed). Purely additive — no data is modified.

-- C3: transaction_type — `weekly_bonus` (cron/bonus-semanal) was never defined.
-- (`refund` is fixed in code by switching to the existing `bet_refund`.)
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'weekly_bonus';

-- C3: notification_type — values inserted by payout/cron but never defined.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bonus';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'market_closing';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watchlist_alert';

-- C4: align notifications columns with the shape the code actually writes.
-- `payload` stays for backward compatibility; new columns are nullable.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body  TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data  JSONB DEFAULT '{}';
