/**
 * Payout de palpites do Concurso.
 * Chamado pelo oracle após resolver um tópico que tem concurso_bets.
 * Usa parimutuel puro (0% comissão — moeda virtual ZC$).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function pagarConcursoBets(
  adminClient: SupabaseClient,
  topicId: string,
  resolution: "sim" | "nao" | "cancelled"
): Promise<void> {
  try {
    const { data: bets } = await adminClient
      .from("concurso_bets")
      .select("id, user_id, concurso_id, side, amount")
      .eq("topic_id", topicId)
      .eq("status", "matched");

    if (!bets || bets.length === 0) {
      // Mesmo sem apostas, atualiza status do topic
      await adminClient.from("topics").update({
        status: "resolved",
        resolution: resolution === "cancelled" ? null : resolution,
        resolved_at: new Date().toISOString(),
      }).eq("id", topicId).eq("concurso_id", bets?.[0]?.concurso_id ?? "").is("concurso_id", null).neq("id", "");
      return;
    }

    if (resolution === "cancelled") {
      for (const bet of bets) {
        const { data: w } = await adminClient
          .from("concurso_wallets")
          .select("balance")
          .eq("user_id", bet.user_id)
          .eq("concurso_id", bet.concurso_id)
          .single();
        await adminClient
          .from("concurso_wallets")
          .update({ balance: (w?.balance ?? 0) + bet.amount, updated_at: new Date().toISOString() })
          .eq("user_id", bet.user_id)
          .eq("concurso_id", bet.concurso_id);
        await adminClient.from("concurso_bets").update({ status: "refunded" }).eq("id", bet.id);
      }
      await adminClient.from("topics").update({
        status: "resolved",
        resolution: null,
        resolved_at: new Date().toISOString(),
      }).eq("id", topicId);
      return;
    }

    const winners = bets.filter((b) => b.side === resolution);
    const losers  = bets.filter((b) => b.side !== resolution);
    const totalWinning = winners.reduce((s, b) => s + Number(b.amount), 0);
    const totalLosing  = losers.reduce((s, b) => s + Number(b.amount), 0);

    // Mark losers
    for (const bet of losers) {
      await adminClient.from("concurso_bets").update({ status: "lost" }).eq("id", bet.id);
    }

    // Pay winners — 100% parimutuel, sem comissão
    for (const bet of winners) {
      const winnerShare = totalWinning > 0 ? (Number(bet.amount) / totalWinning) * totalLosing : 0;
      const payout = Number(bet.amount) + winnerShare;

      await adminClient
        .from("concurso_bets")
        .update({ status: "won", potential_payout: payout })
        .eq("id", bet.id);

      const { data: w } = await adminClient
        .from("concurso_wallets")
        .select("balance")
        .eq("user_id", bet.user_id)
        .eq("concurso_id", bet.concurso_id)
        .single();

      await adminClient
        .from("concurso_wallets")
        .update({ balance: (w?.balance ?? 0) + payout, updated_at: new Date().toISOString() })
        .eq("user_id", bet.user_id)
        .eq("concurso_id", bet.concurso_id);
    }

    // Atualiza status do topic
    await adminClient.from("topics").update({
      status: "resolved",
      resolution,
      resolved_at: new Date().toISOString(),
    }).eq("id", topicId);

    console.log(`[concurso-payout] topic=${topicId} winners=${winners.length} losers=${losers.length}`);
  } catch (err) {
    console.error("[concurso-payout] Erro:", err);
  }
}
