-- Migração 015: tipos de transação usados por bônus e mercado secundário.

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bonus';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_bonus';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'exit_fee';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bet_exited';
