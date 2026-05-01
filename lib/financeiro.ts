/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              CONFIGURAÇÃO FINANCEIRA — ZAFE                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  A Zafe opera com DUAS contas bancárias separadas:           ║
 * ║                                                              ║
 * ║  CONTA OPERACIONAL (sua receita)                             ║
 * ║    → Recebe: comissão de 6% de cada depósito                 ║
 * ║    → É declarada como receita para a Receita Federal         ║
 * ║    → Base de cálculo: ISS, PIS, COFINS, IRPJ                 ║
 * ║                                                              ║
 * ║  CONTA CUSTÓDIA (dinheiro dos usuários)                      ║
 * ║    → Recebe: 96% de cada depósito                            ║
 * ║    → Sai: 100% de cada saque solicitado                      ║
 * ║    → NÃO é receita — é passivo (você deve de volta)          ║
 * ║    → Nunca misturar com a conta operacional                  ║
 * ║                                                              ║
 * ║  Exemplo: usuário deposita R$ 100                            ║
 * ║    → R$ 4,00 → CONTA OPERACIONAL  (sua receita)              ║
 * ║    → R$ 96,00 → CONTA CUSTÓDIA    (pertence ao usuário)      ║
 * ║                                                              ║
 * ║  Quando o usuário saca R$ 96                                 ║
 * ║    → R$ 96,00 sai da CONTA CUSTÓDIA                          ║
 * ║    → CONTA OPERACIONAL não é tocada                          ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Taxas ────────────────────────────────────────────────────────

/** 6% retidos no depósito como receita da plataforma */
export const TAXA_DEPOSITO = 0.06;

/** Percentual que entra na carteira do usuário (100% - taxa) */
export const FATOR_LIQUIDO = 1 - TAXA_DEPOSITO;

/** Saque mínimo — abaixo disso o custo de processamento não compensa */
export const SAQUE_MINIMO = 20;

// Saída antecipada removida — use o mercado secundário (ordem de venda com 6% de taxa).

// ── Identificadores de conta (preencher quando integrar pagamento) ──

/**
 * CONTA CUSTÓDIA — use esta chave/ID ao direcionar depósitos de usuários.
 * Todo depósito deve ter 96% direcionado para esta conta.
 * Todo saque deve sair exclusivamente desta conta.
 *
 * Stripe: defina como uma conta Connect separada ou balance específico
 * Pix:    CNPJ/chave Pix da conta custódia
 */
export const CONTA_CUSTODIA = {
  descricao: "Custódia de usuários — NÃO é receita Zafe",
  // stripe_account_id: process.env.STRIPE_CUSTODIA_ACCOUNT_ID,
  // pix_chave: process.env.PIX_CUSTODIA_CHAVE,
};

/**
 * CONTA OPERACIONAL — use esta chave/ID ao direcionar comissões.
 * Apenas os 6% de comissão devem entrar aqui.
 * É desta conta que saem os custos operacionais da empresa.
 *
 * Stripe: conta principal da plataforma
 * Pix:    CNPJ/chave Pix da conta operacional
 */
export const CONTA_OPERACIONAL = {
  descricao: "Receita Zafe — declarar para Receita Federal",
  // stripe_account_id: process.env.STRIPE_OPERACIONAL_ACCOUNT_ID,
  // pix_chave: process.env.PIX_OPERACIONAL_CHAVE,
};

// ── Helpers ──────────────────────────────────────────────────────

/** Calcula o split de um depósito bruto */
export function calcularSplit(valorBruto: number) {
  const comissao = parseFloat((valorBruto * TAXA_DEPOSITO).toFixed(2));
  const liquido  = parseFloat((valorBruto - comissao).toFixed(2));
  return {
    /** Vai para CONTA_OPERACIONAL — sua receita */
    comissao,
    /** Vai para CONTA_CUSTODIA — pertence ao usuário */
    liquido,
    /** Referência: onde cada centavo deve ir */
    destinos: {
      [CONTA_OPERACIONAL.descricao]: comissao,
      [CONTA_CUSTODIA.descricao]: liquido,
    },
  };
}
