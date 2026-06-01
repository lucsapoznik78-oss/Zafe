/**
 * Shared payout/refund logic — used by both admin/resolver and oracle system
 * Após cada resolução de mercado público, dispara auto-reposição (ver lib/auto-replenish.ts)
 */
import { replenishMarkets } from "@/lib/auto-replenish";
import { sendPushToUser } from "@/lib/webpush";
import { cancelTopicOrders } from "@/lib/order-matching";
import { creditBalance } from "@/lib/wallet";

function fmt(v: number) {
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const BONUS_PIONEIRO = 10;

/**
 * Dá Z$ 10 para o primeiro palpite de cada lado (SIM e NAO) quando o evento é confirmado.
 * Incentivo para abertura de eventos.
 */
async function pagarBonusPioneiro(supabase: any, topicId: string, topicTitle: string) {
  for (const side of ["sim", "nao"] as const) {
    const { data: first } = await supabase
      .from("bets")
      .select("user_id")
      .eq("topic_id", topicId)
      .eq("side", side)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!first) continue;

    await creditBalance(supabase, first.user_id, BONUS_PIONEIRO);
    await supabase.from("transactions").insert({
      user_id: first.user_id,
      type: "bonus",
      amount: BONUS_PIONEIRO,
      net_amount: BONUS_PIONEIRO,
      description: `Bônus pioneiro ${side.toUpperCase()} — "${topicTitle.slice(0, 50)}"`,
      reference_id: topicId,
    });
    await supabase.from("notifications").insert({
      user_id: first.user_id,
      type: "bonus",
      title: "Bônus pioneiro! +Z$ 10",
      body: `Você foi o primeiro a palpitar ${side.toUpperCase()} em "${topicTitle.slice(0, 50)}" e o evento foi confirmado.`,
      data: { topic_id: topicId },
    });
  }
}

export async function refundBet(supabase: any, bet: any, topicId: string, reason: string) {
  await creditBalance(supabase, bet.user_id, bet.amount);
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
  const { data: topic } = await supabase.from("topics").select("title, concurso_id").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  // Se o topic pertence a um concurso, ignora — reembolso é feito por pagarConcursoBets
  if (topic?.concurso_id) {
    return { note: "skipped_concurso_topic" };
  }

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

export async function pagarVencedoresMulti(
  supabase: any,
  topicId: string,
  winningOutcomeId: string,
  resolvedBy?: string
) {
  const { data: topic } = await supabase.from("topics").select("title, concurso_id").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  if (topic?.concurso_id) {
    return { note: "skipped_concurso_topic" };
  }

  const { data: allBets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.outcome_id === winningOutcomeId);
  const loserBets  = bets.filter((b: any) => b.outcome_id !== winningOutcomeId);

  if (winnerBets.length === 0) {
    await reembolsarTodos(supabase, topicId, "Sem palpites no resultado vencedor", resolvedBy);
    return { note: "no_coverage_refund" };
  }

  // Reembolsa se menos de 2 outcomes distintos têm palpites (sem competição real)
  const outcomesComBets = new Set(bets.map((b: any) => b.outcome_id)).size;
  if (outcomesComBets < 2) {
    await reembolsarTodos(supabase, topicId, "Apenas 1 resultado teve palpites — sem competição", resolvedBy);
    return { note: "no_coverage_refund" };
  }

  const totalWinPool  = winnerBets.reduce((s: number, b: any) => s + b.amount, 0);
  const totalLosePool = loserBets.reduce((s: number, b: any) => s + b.amount, 0);

  for (const bet of winnerBets) {
    const winnings = parseFloat(((bet.amount / totalWinPool) * totalLosePool).toFixed(2));
    const payout   = parseFloat((bet.amount + winnings).toFixed(2));
    await creditBalance(supabase, bet.user_id, payout);
    await supabase.from("bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id);
    await supabase.from("transactions").insert({
      user_id: bet.user_id, type: "bet_won", amount: payout, net_amount: payout,
      description: `Ganhou — resultado vencedor`, reference_id: topicId,
    });
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "bet_won",
      title: "Você ganhou! 🏆",
      body: `Seu palpite em "${title}" rendeu ${fmt(payout)}.`,
      data: { topic_id: topicId, payout },
    });
  }

  for (const bet of loserBets) {
    await supabase.from("bets").update({ status: "lost" }).eq("id", bet.id);
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado resolvido",
      body: `"${title}" foi resolvido. Boa sorte na próxima!`,
      data: { topic_id: topicId },
    });
  }

  const { data: topicMeta } = await supabase.from("topics").select("is_private").eq("id", topicId).single();
  await cancelTopicOrders(supabase, topicId).catch((e: any) => console.error("[payout] cancelTopicOrders:", e));

  await supabase.from("topics").update({
    status: "resolved",
    winning_outcome_id: winningOutcomeId,
    resolved_at: new Date().toISOString(),
    ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
  }).eq("id", topicId);

  // Bônus pioneiro — Z$ 10 para primeiro de cada lado
  pagarBonusPioneiro(supabase, topicId, title).catch((e: any) =>
    console.error("[payout] bonus pioneiro error:", e)
  );

  if (!topicMeta?.is_private) {
    replenishMarkets(supabase).catch((e: any) => console.error("[payout] replenish:", e));
  }

  return { note: "paid" };
}

export async function pagarVencedores(
  supabase: any,
  topicId: string,
  resolution: "sim" | "nao",
  resolvedBy?: string
) {
  const { data: topic } = await supabase.from("topics").select("title, concurso_id").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  // Se o topic pertence a um concurso, ignora — pago é feito por pagarConcursoBets
  if (topic?.concurso_id) {
    return { note: "skipped_concurso_topic" };
  }

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

    await creditBalance(supabase, bet.user_id, payout);
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

  // Bônus pioneiro — Z$ 10 para primeiro de cada lado
  pagarBonusPioneiro(supabase, topicId, title).catch((e) =>
    console.error("[payout] bonus pioneiro error:", e)
  );

  // Repor mercado público automaticamente
  if (!topicMeta2?.is_private) {
    replenishMarkets(supabase).catch((e) =>
      console.error("[payout] replenish error:", e)
    );
  }

  return { note: "paid" };
}
