-- Add locked_odds and gross_amount to bets
ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS locked_odds NUMERIC(10,4) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2);

-- Add title/body/data to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS "data" JSONB DEFAULT '{}';

-- Index for double-side prevention
CREATE INDEX IF NOT EXISTS idx_bets_user_topic_side
  ON bets(user_id, topic_id, side)
  WHERE status NOT IN ('refunded','lost');
