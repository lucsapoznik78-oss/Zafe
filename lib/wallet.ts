/**
 * Ajuste de saldo de carteira com trava otimista (compare-and-set).
 *
 * O modelo de saldo do Zafe é um único campo `balance` por usuário. Sem trava,
 * duas operações concorrentes leem o mesmo saldo e a segunda escrita sobrescreve
 * a primeira, duplicando ou destruindo Z$. Estas funções leem o saldo, escrevem
 * condicionando em `.eq("balance", saldoLido)` e — crucialmente — verificam via
 * `.select()` se alguma linha foi de fato alterada. Se outra transação alterou o
 * saldo no intervalo, a escrita afeta 0 linhas e tentamos novamente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 5;

export type BalanceResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "conflict" | "missing" };

/**
 * Credita (delta > 0) ou debita (delta < 0) o saldo do usuário de forma atômica.
 * Debita apenas se houver saldo suficiente (saldo final não pode ficar negativo).
 */
export async function adjustBalance(
  client: SupabaseClient,
  userId: string,
  delta: number,
): Promise<BalanceResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: wallet } = await client
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (!wallet) return { ok: false, reason: "missing" };

    const current = wallet.balance as number;
    const next = parseFloat((current + delta).toFixed(2));
    if (next < 0) return { ok: false, reason: "insufficient" };

    const { data: updated } = await client
      .from("wallets")
      .update({ balance: next })
      .eq("user_id", userId)
      .eq("balance", current)
      .select("balance");

    if (updated && updated.length > 0) {
      return { ok: true, balance: next };
    }
    // 0 linhas alteradas → outra transação concorrente mudou o saldo. Re-tenta.
  }
  return { ok: false, reason: "conflict" };
}

/** Credita o saldo do usuário (atômico). Credito nunca falha por saldo. */
export function creditBalance(client: SupabaseClient, userId: string, amount: number) {
  return adjustBalance(client, userId, Math.abs(amount));
}

/** Debita o saldo do usuário (atômico). Falha se saldo insuficiente. */
export function debitBalance(client: SupabaseClient, userId: string, amount: number) {
  return adjustBalance(client, userId, -Math.abs(amount));
}
