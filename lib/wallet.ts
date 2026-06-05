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

/**
 * Ajuste atômico (CAS) para carteiras de concurso (ZC$), chaveadas por
 * user_id + concurso_id. Mesma trava otimista de adjustBalance: lê o saldo,
 * escreve condicionando em `.eq("balance", saldoLido)` e confirma via
 * `.select()` que 1 linha foi alterada — caso contrário re-tenta. Isto fecha
 * o double-spend silencioso em que `.gte()` casava 0 linhas sem erro.
 */
export async function adjustConcursoBalance(
  client: SupabaseClient,
  userId: string,
  concursoId: string,
  delta: number,
): Promise<BalanceResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: wallet } = await client
      .from("concurso_wallets")
      .select("balance")
      .eq("user_id", userId)
      .eq("concurso_id", concursoId)
      .single();

    if (!wallet) return { ok: false, reason: "missing" };

    const current = wallet.balance as number;
    const next = parseFloat((current + delta).toFixed(2));
    if (next < 0) return { ok: false, reason: "insufficient" };

    const { data: updated } = await client
      .from("concurso_wallets")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("concurso_id", concursoId)
      .eq("balance", current)
      .select("balance");

    if (updated && updated.length > 0) {
      return { ok: true, balance: next };
    }
  }
  return { ok: false, reason: "conflict" };
}

/** Credita a carteira de concurso (atômico). */
export function creditConcursoBalance(client: SupabaseClient, userId: string, concursoId: string, amount: number) {
  return adjustConcursoBalance(client, userId, concursoId, Math.abs(amount));
}

/** Debita a carteira de concurso (atômico). Falha se saldo insuficiente. */
export function debitConcursoBalance(client: SupabaseClient, userId: string, concursoId: string, amount: number) {
  return adjustConcursoBalance(client, userId, concursoId, -Math.abs(amount));
}
