-- ============================================================
-- ZAFE — Migration 049: Concurso pago (inscrição R$ → prêmio R$ fixo via PIX)
-- ============================================================
-- Fase 3 do pivot fantasy. Habilita o Concurso PAGO mantendo a regra de ouro:
--   * A inscrição em R$ é uma TAXA — nunca vira saldo (não há R$↔Z$/ZC$).
--   * ZC$ continua sendo só pontuação interna do concurso (carteira virtual).
--   * O prêmio sai em R$ por PIX da conta operacional da Zafe.
--   * Prêmio FIXO, anunciado na abertura (Art. 49, Lei 14.790/2023): o valor
--     independe do número de inscritos ou do total arrecadado.
--
-- IMPORTANTE: o provedor de pagamento (PIX) e a conta bancária/CNPJ ainda NÃO
-- estão integrados. Este schema deixa tudo pronto; enquanto `concursos.pago`
-- for `false` (default), o fluxo de inscrição grátis atual continua idêntico.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS. Escritas seguem exclusivas do service role (sem policy
-- de write = negado para anon/authenticated; service role ignora RLS).

-- ── concursos: marca o concurso como pago e o valor da inscrição ──────
ALTER TABLE concursos ADD COLUMN IF NOT EXISTS pago BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE concursos ADD COLUMN IF NOT EXISTS valor_inscricao_centavos INTEGER NOT NULL DEFAULT 0;

-- ── pagamentos_concurso: cobrança da inscrição (taxa em R$) ───────────
-- Uma cobrança PIX por tentativa de inscrição. `status` evolui:
--   pending → paid | expired | failed | refunded
-- Ao confirmar (paid), o webhook chama concurso_inscrever() e libera a entrada.
CREATE TABLE IF NOT EXISTS pagamentos_concurso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'unconfigured',   -- mercadopago | pagarme | stripe | unconfigured
  provider_payment_id TEXT,                         -- id da cobrança no provedor (idempotência)
  status TEXT NOT NULL DEFAULT 'pending',           -- pending | paid | expired | failed | refunded
  valor_centavos INTEGER NOT NULL,                  -- valor da inscrição (taxa) — NUNCA vira saldo
  pix_copia_cola TEXT,                              -- payload "copia e cola" do provedor
  pix_qr_base64 TEXT,                               -- QR code (imagem base64), se houver
  expira_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotência do webhook: um provider_payment_id nunca processa duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_provider_id
  ON pagamentos_concurso(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_user_concurso
  ON pagamentos_concurso(user_id, concurso_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status
  ON pagamentos_concurso(status, criado_em);

-- ── payouts_concurso: razão dos prêmios pagos aos vencedores (R$ via PIX) ──
-- Um registro por vencedor por concurso. O envio do PIX pode ser manual no
-- início; esta tabela é a fonte de verdade do que foi/será pago.
CREATE TABLE IF NOT EXISTS payouts_concurso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concurso_id UUID NOT NULL REFERENCES concursos(id) ON DELETE CASCADE,
  posicao INTEGER NOT NULL,
  valor_centavos INTEGER NOT NULL,                  -- prêmio fixo (Art. 49)
  pix_key TEXT,                                     -- chave PIX informada pelo vencedor
  pix_key_type TEXT,                                -- cpf | email | telefone | aleatoria
  status TEXT NOT NULL DEFAULT 'pending',           -- pending | processing | paid | failed
  provider TEXT,                                    -- provedor do payout, quando automatizado
  provider_payout_id TEXT,
  pago_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concurso_id)
);

CREATE INDEX IF NOT EXISTS idx_payouts_concurso ON payouts_concurso(concurso_id, posicao);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts_concurso(status, criado_em);

-- ── RLS: leitura só do dono; escrita só service role (padrão migration 030) ──
ALTER TABLE pagamentos_concurso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagamentos_select_own ON pagamentos_concurso;
CREATE POLICY pagamentos_select_own ON pagamentos_concurso
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE payouts_concurso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payouts_select_own ON payouts_concurso;
CREATE POLICY payouts_select_own ON payouts_concurso
  FOR SELECT TO authenticated USING (user_id = auth.uid());
