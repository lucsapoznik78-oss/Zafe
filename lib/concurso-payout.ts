/**
 * Payout de palpites do Concurso.
 * Chamado pelo oracle após resolver um tópico que tem concurso_bets.
 * Usa parimutuel puro (0% comissão — moeda virtual ZC$).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BONUS_PIONEIRO = 10;

async function pagarBonusPioneiroConcurso(
  adminClient: SupabaseClient,
  topicId: string,
  topicTitle: string
) {
  for (const side of ["sim", "nao"] as const) {
    const { data: first } = await adminClient
      .from("concurso_bets")
      .select("user_id")
      .eq("topic_id", topicId)
      .eq("side", side)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!first) continue;

    const { data: w } = await adminClient.from("wallets").select("balance").eq("user_id", first.user_id).single();
    await adminClient.from("wallets").update({ balance: (w?.balance ?? 0) + BONUS_PIONEIRO }).eq("user_id", first.user_id);
    await adminClient.from("transactions").insert({
      user_id: first.user_id,
      type: "bonus",
      amount: BONUS_PIONEIRO,
      net_amount: BONUS_PIONEIRO,
      description: `Bônus pioneiro ${side.toUpperCase()} — "${topicTitle.slice(0, 50)}"`,
      reference_id: topicId,
    });
    await adminClient.from("notifications").insert({
      user_id: first.user_id,
      type: "bonus",
      title: "Bônus pioneiro! +Z$ 10",
      body: `Você foi o primeiro a palpitar ${side.toUpperCase()} em "${topicTitle.slice(0, 50)}" e o evento foi confirmado.`,
      data: { topic_id: topicId },
    });
  }
}

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

    // Bônus pioneiro — Z$ 10 para primeiro de cada lado (wallet principal)
    const { data: topicMeta } = await adminClient.from("topics").select("title").eq("id", topicId).single();
    pagarBonusPioneiroConcurso(adminClient, topicId, topicMeta?.title ?? "").catch((e) =>
      console.error("[concurso-payout] bonus pioneiro error:", e)
    );

    console.log(`[concurso-payout] topic=${topicId} winners=${winners.length} losers=${losers.length}`);
  } catch (err) {
    console.error("[concurso-payout] Erro:", err);
  }
}

export async function pagarConcursoBetsMulti(
  adminClient: SupabaseClient,
  topicId: string,
  winningOutcomeId: string
): Promise<void> {
  try {
    const { data: bets } = await adminClient
      .from("concurso_bets")
      .select("id, user_id, concurso_id, outcome_id, amount")
      .eq("topic_id", topicId)
      .eq("status", "matched");

    if (!bets || bets.length === 0) return;

    const winners = bets.filter((b) => b.outcome_id === winningOutcomeId);
    const losers  = bets.filter((b) => b.outcome_id !== winningOutcomeId);
    const totalWinning = winners.reduce((s, b) => s + Number(b.amount), 0);
    const totalLosing  = losers.reduce((s, b) => s + Number(b.amount), 0);

    for (const bet of losers) {
      await adminClient.from("concurso_bets").update({ status: "lost" }).eq("id", bet.id);
    }

    for (const bet of winners) {
      const winnerShare = totalWinning > 0 ? (Number(bet.amount) / totalWinning) * totalLosing : 0;
      const payout = Number(bet.amount) + winnerShare;
      await adminClient.from("concurso_bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id);
      const { data: w } = await adminClient
        .from("concurso_wallets").select("balance")
        .eq("user_id", bet.user_id).eq("concurso_id", bet.concurso_id).single();
      await adminClient.from("concurso_wallets")
        .update({ balance: (w?.balance ?? 0) + payout, updated_at: new Date().toISOString() })
        .eq("user_id", bet.user_id).eq("concurso_id", bet.concurso_id);
    }

    await adminClient.from("topics").update({
      status: "resolved",
      winning_outcome_id: winningOutcomeId,
      resolved_at: new Date().toISOString(),
    }).eq("id", topicId);

    console.log(`[concurso-payout/multi] topic=${topicId} winners=${winners.length} losers=${losers.length}`);
  } catch (err) {
    console.error("[concurso-payout/multi] Erro:", err);
  }
}
