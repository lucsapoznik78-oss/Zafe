/**
 * Shared payout/refund logic — used by both admin/resolver and oracle system
 * Após cada resolução de mercado público, dispara auto-reposição (ver lib/auto-replenish.ts)
 */
import { replenishMarkets } from "@/lib/auto-replenish";
import { sendPushToUser } from "@/lib/webpush";
import { cancelTopicOrders } from "@/lib/order-matching";

function fmt(v: number) {
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function refundBet(supabase: any, bet: any, topicId: string, reason: string) {
  const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", bet.user_id).single();
  await supabase.from("wallets").update({ balance: (w?.balance ?? 0) + bet.amount }).eq("user_id", bet.user_id);
  await supabase.from("bets").update({ status: "refunded" }).eq("id", bet.id);
  await supabase.from("transactions").insert({
    user_id: bet.user_id, type: "bet_refund", amount: bet.amount, net_amount: bet.amount,
    description: `Reembolso — ${reason}`, reference_id: topicId,
  });
}

export async function reembolsarTodos(
  supabase: any,
  topicId: string,
  motivo: string,
  resolvedBy?: string
) {
  const { data: topic } = await supabase.from("topics").select("title").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  const { data: bets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  for (const bet of bets ?? []) {
    await refundBet(supabase, bet, topicId, motivo);
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado reembolsado",
      body: `"${title}": ${motivo}. Reembolso de ${fmt(bet.amount)} creditado.`,
      data: { topic_id: topicId },
    });
  }

  const { data: topicMeta } = await supabase.from("topics").select("is_private").eq("id", topicId).single();

  // Cancelar ordens abertas e devolver escrow
  await cancelTopicOrders(supabase, topicId).catch(e =>
    console.error("[payout] cancelTopicOrders error:", e)
  );

  await supabase.from("topics").update({
    status: "resolved",
    resolution: null,
    resolved_at: new Date().toISOString(),
    ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
  }).eq("id", topicId);

  // Repor mercado público automaticamente
  if (!topicMeta?.is_private) {
    replenishMarkets(supabase).catch((e) =>
      console.error("[payout] replenish error:", e)
    );
  }
}

export async function pagarVencedores(
  supabase: any,
  topicId: string,
  resolution: "sim" | "nao",
  resolvedBy?: string
) {
  const { data: topic } = await supabase.from("topics").select("title").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  const { data: allBets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.side === resolution);
  const loserBets  = bets.filter((b: any) => b.side !== resolution);

  // Um lado sem apostas → reembolso total
  if (winnerBets.length === 0 || loserBets.length === 0) {
    await reembolsarTodos(supabase, topicId, "Sem apostas no lado oposto", resolvedBy);
    return { note: "no_coverage_refund" };
  }

  const totalWinPool  = winnerBets.reduce((s: number, b: any) => s + b.amount, 0);
  const totalLosePool = loserBets.reduce((s: number, b: any) => s + b.amount, 0);

  for (const bet of winnerBets) {
    const winnings = parseFloat(((bet.amount / totalWinPool) * totalLosePool).toFixed(2));
    const payout   = parseFloat((bet.amount + winnings).toFixed(2));

    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", bet.user_id).single();
    await supabase.from("wallets").update({ balance: (w?.balance ?? 0) + payout }).eq("user_id", bet.user_id);
    await supabase.from("bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id);
    await supabase.from("transactions").insert({
      user_id: bet.user_id, type: "bet_won", amount: payout, net_amount: payout,
      description: `Ganhou — ${resolution.toUpperCase()}`, reference_id: topicId,
    });
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "bet_won",
      title: "Você ganhou! 🏆",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
      data: { topic_id: topicId, payout },
    });
    sendPushToUser(supabase, bet.user_id, {
      title: "Você ganhou! 🏆",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
      url: `/liga/${topicId}`,
    }).catch(() => {});
  }

  for (const bet of loserBets) {
    await supabase.from("bets").update({ status: "lost" }).eq("id", bet.id);
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado resolvido",
      body: `"${title}" foi resolvido como ${resolution.toUpperCase()}. Boa sorte na próxima!`,
      data: { topic_id: topicId },
    });
  }

  const { data: topicMeta2 } = await supabase.from("topics").select("is_private").eq("id", topicId).single();

  // Cancelar ordens abertas e devolver escrow
  await cancelTopicOrders(supabase, topicId).catch(e =>
    console.error("[payout] cancelTopicOrders error:", e)
  );

  await supabase.from("topics").update({
    status: "resolved", resolution,
    resolved_at: new Date().toISOString(),
    ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
  }).eq("id", topicId);

  // Repor mercado público automaticamente
  if (!topicMeta2?.is_private) {
    replenishMarkets(supabase).catch((e) =>
      console.error("[payout] replenish error:", e)
    );
  }

  return { note: "paid" };
}
