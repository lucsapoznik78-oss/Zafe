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
 * Z$ efetivamente debitado por uma posição (audit G3/G4). Posições compradas
 * no mercado secundário gravam cost_basis = price*quantity (o que o comprador
 * pagou); palpites primários têm cost_basis nulo e usam amount (o stake cheio).
 * Reembolsar/ponderar pelo face value cunhava Z$ e desbalanceava o pool.
 */
function stakeOf(b: { cost_basis?: number | null; amount: number }): number {
  return b.cost_basis != null ? Number(b.cost_basis) : Number(b.amount);
}

/** Executa `fn` sobre os itens em lotes paralelos de `size` (audit #32). */
async function emLotes<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

/** Soma valores por usuário para creditar uma única vez por carteira (CAS preservado). */
function somarPorUsuario(items: { user_id: string; valor: number }[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    m.set(it.user_id, parseFloat(((m.get(it.user_id) ?? 0) + it.valor).toFixed(2)));
  }
  return [...m.entries()];
}

/**
 * Trava atômica de resolução. Marca o topic como `resolved` condicionando em
 * que ele ainda NÃO esteja num estado terminal (`resolved`/`cancelled`) e
 * confirma via `.select()` que esta chamada foi a que alterou a linha. Fecha a
 * corrida de dupla-resolução: o botão admin "Resolver agora" e o cron oracle
 * selecionam os mesmos topics `resolving` e chamam pagarVencedores; sem esta
 * trava ambos passam pelo filtro de status antes de qualquer escrita e
 * pagam os vencedores duas vezes. Quem perde a corrida recebe 0 linhas e sai.
 */
async function claimTopicForResolution(supabase: any, topicId: string): Promise<boolean> {
  const { data } = await supabase
    .from("topics")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", topicId)
    .not("status", "in", '("resolved","cancelled")')
    .select("id");
  return !!(data && data.length > 0);
}

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

/**
 * Reembolsa um conjunto de bets em lote (audit #32): crédito agregado por
 * usuário + UPDATE/INSERTs em bulk, em vez de 3 awaits por palpite.
 */
async function refundBets(supabase: any, bets: any[], topicId: string, reason: string) {
  if (bets.length === 0) return;

  const creditos = somarPorUsuario(bets.map((b) => ({ user_id: b.user_id, valor: stakeOf(b) })));
  await emLotes(creditos, 10, ([userId, total]) => creditBalance(supabase, userId, total));

  await supabase.from("bets").update({ status: "refunded" }).in("id", bets.map((b) => b.id));
  await supabase.from("transactions").insert(bets.map((bet) => ({
    user_id: bet.user_id, type: "bet_refund", amount: stakeOf(bet), net_amount: stakeOf(bet),
    description: `Reembolso — ${reason}`, reference_id: topicId,
  })));
}

export async function reembolsarTodos(
  supabase: any,
  topicId: string,
  motivo: string,
  resolvedBy?: string,
  alreadyClaimed = false
) {
  const { data: topic } = await supabase.from("topics").select("title, concurso_id").eq("id", topicId).single();
  const title = topic?.title?.slice(0, 55) ?? "Mercado";

  // Se o topic pertence a um concurso, ignora — reembolso é feito por pagarConcursoBets
  if (topic?.concurso_id) {
    return { note: "skipped_concurso_topic" };
  }

  // Trava de dupla-resolução (pulada quando chamada internamente por um
  // pagarVencedores que já reivindicou o topic).
  if (!alreadyClaimed && !(await claimTopicForResolution(supabase, topicId))) {
    return { note: "already_resolved" };
  }

  const { data: bets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  const betsList = bets ?? [];
  await refundBets(supabase, betsList, topicId, motivo);
  if (betsList.length > 0) {
    await supabase.from("notifications").insert(betsList.map((bet: any) => ({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado reembolsado",
      body: `"${title}": ${motivo}. Reembolso de ${fmt(stakeOf(bet))} creditado.`,
      data: { topic_id: topicId },
    })));
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

  // Trava atômica de dupla-resolução — quem perde a corrida sai sem pagar.
  if (!(await claimTopicForResolution(supabase, topicId))) {
    return { note: "already_resolved" };
  }

  const { data: allBets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.outcome_id === winningOutcomeId);
  const loserBets  = bets.filter((b: any) => b.outcome_id !== winningOutcomeId);

  if (winnerBets.length === 0) {
    await reembolsarTodos(supabase, topicId, "Sem palpites no resultado vencedor", resolvedBy, true);
    return { note: "no_coverage_refund" };
  }

  // Reembolsa se menos de 2 outcomes distintos têm palpites (sem competição real)
  const outcomesComBets = new Set(bets.map((b: any) => b.outcome_id)).size;
  if (outcomesComBets < 2) {
    await reembolsarTodos(supabase, topicId, "Apenas 1 resultado teve palpites — sem competição", resolvedBy, true);
    return { note: "no_coverage_refund" };
  }

  const totalWinPool  = winnerBets.reduce((s: number, b: any) => s + stakeOf(b), 0);
  const totalLosePool = loserBets.reduce((s: number, b: any) => s + stakeOf(b), 0);

  // Audit #32: pagamento em lote — crédito agregado por usuário (CAS
  // preservado), updates de bets em paralelo controlado, INSERTs em bulk.
  // Audit G4: pondera pelo cost_basis (stake real), não pelo face value.
  const winners = winnerBets.map((bet: any) => {
    const stake = stakeOf(bet);
    const winnings = parseFloat(((stake / totalWinPool) * totalLosePool).toFixed(2));
    return { bet, payout: parseFloat((stake + winnings).toFixed(2)) };
  });

  const creditos = somarPorUsuario(winners.map((w: any) => ({ user_id: w.bet.user_id, valor: w.payout })));
  await emLotes(creditos, 10, ([userId, total]) => creditBalance(supabase, userId, total));

  await emLotes(winners, 10, ({ bet, payout }: any) =>
    supabase.from("bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id)
  );

  await supabase.from("transactions").insert(winners.map(({ bet, payout }: any) => ({
    user_id: bet.user_id, type: "bet_won", amount: payout, net_amount: payout,
    description: `Ganhou — resultado vencedor`, reference_id: topicId,
  })));

  await supabase.from("notifications").insert(winners.map(({ bet, payout }: any) => ({
    user_id: bet.user_id, type: "bet_won",
    title: "Você ganhou! 🏆",
    body: `Seu palpite em "${title}" rendeu ${fmt(payout)}.`,
    data: { topic_id: topicId, payout },
  })));

  if (loserBets.length > 0) {
    await supabase.from("bets").update({ status: "lost" }).in("id", loserBets.map((b: any) => b.id));
    await supabase.from("notifications").insert(loserBets.map((bet: any) => ({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado resolvido",
      body: `"${title}" foi resolvido. Boa sorte na próxima!`,
      data: { topic_id: topicId },
    })));
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

  // Trava atômica de dupla-resolução — quem perde a corrida sai sem pagar.
  if (!(await claimTopicForResolution(supabase, topicId))) {
    return { note: "already_resolved" };
  }

  const { data: allBets } = await supabase
    .from("bets").select("*").eq("topic_id", topicId).not("status", "in", '("refunded","exited","won","lost")');

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.side === resolution);
  const loserBets  = bets.filter((b: any) => b.side !== resolution);

  // Um lado sem apostas → reembolso total
  if (winnerBets.length === 0 || loserBets.length === 0) {
    await reembolsarTodos(supabase, topicId, "Sem apostas no lado oposto", resolvedBy, true);
    return { note: "no_coverage_refund" };
  }

  const totalWinPool  = winnerBets.reduce((s: number, b: any) => s + stakeOf(b), 0);
  const totalLosePool = loserBets.reduce((s: number, b: any) => s + stakeOf(b), 0);

  // Audit #32: pagamento em lote — crédito agregado por usuário (CAS
  // preservado), updates de bets em paralelo controlado, INSERTs em bulk.
  // Audit G4: pondera pelo cost_basis (stake real), não pelo face value.
  const winners = winnerBets.map((bet: any) => {
    const stake = stakeOf(bet);
    const winnings = parseFloat(((stake / totalWinPool) * totalLosePool).toFixed(2));
    return { bet, payout: parseFloat((stake + winnings).toFixed(2)) };
  });

  const creditos = somarPorUsuario(winners.map((w: any) => ({ user_id: w.bet.user_id, valor: w.payout })));
  await emLotes(creditos, 10, ([userId, total]) => creditBalance(supabase, userId, total));

  await emLotes(winners, 10, ({ bet, payout }: any) =>
    supabase.from("bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id)
  );

  await supabase.from("transactions").insert(winners.map(({ bet, payout }: any) => ({
    user_id: bet.user_id, type: "bet_won", amount: payout, net_amount: payout,
    description: `Ganhou — ${resolution.toUpperCase()}`, reference_id: topicId,
  })));

  await supabase.from("notifications").insert(winners.map(({ bet, payout }: any) => ({
    user_id: bet.user_id, type: "bet_won",
    title: "Você ganhou! 🏆",
    body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
    data: { topic_id: topicId, payout },
  })));

  for (const { bet, payout } of winners) {
    sendPushToUser(supabase, bet.user_id, {
      title: "Você ganhou! 🏆",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
      url: `/liga/${topicId}`,
    }).catch(() => {});
  }

  if (loserBets.length > 0) {
    await supabase.from("bets").update({ status: "lost" }).in("id", loserBets.map((b: any) => b.id));
    await supabase.from("notifications").insert(loserBets.map((bet: any) => ({
      user_id: bet.user_id, type: "market_resolved",
      title: "Mercado resolvido",
      body: `"${title}" foi resolvido como ${resolution.toUpperCase()}. Boa sorte na próxima!`,
      data: { topic_id: topicId },
    })));
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
