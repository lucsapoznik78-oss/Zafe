-- 023 — Coluna de versão na carteira + tipo de transação de estorno.
-- Aditiva e idempotente (no-op em prod). Cobre auditoria H12 e #18.

-- H12: a tabela `wallets` não tinha coluna `version` (viola a regra 3 do CLAUDE).
-- O CAS atual trava em `.eq("balance", saldoLido)`, o que funciona, mas uma
-- coluna `version` dedicada é mais robusta (não falha quando dois ajustes
-- resultam no mesmo saldo) e documenta a intenção de trava otimista.
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Incrementa a versão automaticamente a cada mudança de saldo.
CREATE OR REPLACE FUNCTION bump_wallet_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_wallet_version ON wallets;
CREATE TRIGGER trg_bump_wallet_version
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION bump_wallet_version();

-- #18: estorno de resolução revertida precisa de um tipo de transação próprio
-- para deixar o clawback auditável (antes o débito sumia silenciosamente).
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'reversal';
