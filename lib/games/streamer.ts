/**
 * Zafe Games — rev share do programa de streamers.
 *
 * Quando um usuário TRAZIDO por um streamer vira Premium, confirmamos a
 * atribuição e registramos o ganho (rev share) num ledger auditável. O valor
 * é R$ (receita da operação), NUNCA Z$ — não toca a carteira do usuário.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Preço mensal do Premium (R$). Espelha a página /premium.
export const PREMIUM_PRICE_BRL = 19.9;

/**
 * Registra a conversão Premium de um usuário trazido por streamer:
 *  - confirma a atribuição pendente (status 'pending' → 'confirmed');
 *  - lança o ganho do streamer = rev_share_pct% do preço do Premium.
 * Idempotente: só lança se a atribuição ainda estava 'pending' (claim
 * atômico no UPDATE), então reativar Premium não paga 2x.
 */
export async function recordPremiumConversion(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: ref } = await admin
    .from("games_referrals")
    .select("id, streamer_id, status")
    .eq("referred_user_id", userId)
    .maybeSingle();

  if (!ref || ref.status !== "pending") return; // sem atribuição válida ou já processada

  // Claim atômico pending→confirmed: só o primeiro a virar a linha lança o ganho.
  const { data: claimed } = await admin
    .from("games_referrals")
    .update({ status: "confirmed" })
    .eq("id", ref.id)
    .eq("status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) return;

  const { data: streamer } = await admin
    .from("games_streamers")
    .select("id, status, rev_share_pct")
    .eq("id", ref.streamer_id)
    .maybeSingle();

  if (!streamer || streamer.status !== "active") return;

  const amount = Number((PREMIUM_PRICE_BRL * (Number(streamer.rev_share_pct) / 100)).toFixed(2));
  await admin.from("games_streamer_earnings").insert({
    streamer_id: streamer.id,
    referred_user_id: userId,
    source: "premium_conversion",
    amount,
  });
}
