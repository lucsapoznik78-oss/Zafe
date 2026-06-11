-- ============================================================
-- ZAFE — Migration 036: gestão de usuários no admin (audit #21)
-- ============================================================
-- #21: faltavam três fluxos de admin — banir/suspender, visão de carteira
-- por usuário e ajuste manual de Z$. Esta migration cria a base de dados:
-- a coluna `banned` (enforcement no middleware + rotas /api/admin/usuarios)
-- e o tipo de transação para ajustes manuais auditáveis.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'manual_adjustment';
