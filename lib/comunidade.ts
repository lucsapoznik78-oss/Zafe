/**
 * Pilar 5 — Zafe Comunidade
 * Eventos criados e resolvidos pela galera. Pura diversão.
 * Conta para ranking geral mas NÃO para concurso.
 */

import { calcOdds } from "@/lib/odds";
import { sendPushToUser } from "@/lib/webpush";
import { debitBalance, creditBalance } from "@/lib/wallet";
import { emLotes, somarPorUsuario } from "@/lib/payout";

function fmt(v: number) {
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Reputation helpers ──────────────────────────────────────────

export async function getOrCreateReputation(supabase: any, userId: string) {
  const { data } = await supabase
    .from("creator_reputation")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (data) return data;

  const { data: created } = await supabase
    .from("creator_reputation")
    .insert({ user_id: userId })
    .select()
    .single();
  return created;
}

export async function adjustReputation(
  supabase: any,
  userId: string,
  delta: number,
  updates: Record<string, any> = {}
) {
  const rep = await getOrCreateReputation(supabase, userId);
  if (!rep) return;
  const newScore = Math.max(0, Math.min(100, rep.score + delta));
  await supabase
    .from("creator_reputation")
    .update({
      score: newScore,
      updated_at: new Date().toISOString(),
      ...updates,
    })
    .eq("user_id", userId);
}

// ── Palpitar na Comunidade ──────────────────────────────────────

export async function executeCommunityBet(
  supabase: any,
  userId: string,
  eventId: string,
  side: string,
  amount: number
) {
  amount = Number(amount);
  if (!["sim", "nao"].includes(side) || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Dados inválidos", status: 400 };
  }

  const { data: event } = await supabase
    .from("community_events")
    .select("status, closes_at, creator_id")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "active") {
    return { error: "Evento inválido ou encerrado", status: 400 };
  }
  if (new Date(event.closes_at) < new Date()) {
    return { error: "O prazo para palpitar já encerrou", status: 400 };
  }
  // O criador resolve o próprio evento — palpitar nele seria conflito de
  // interesse (poderia resolver a favor do próprio palpite).
  if (event.creator_id === userId) {
    return { error: "Você não pode palpitar no evento que você criou.", status: 403 };
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!wallet || wallet.balance < amount) {
    return { error: "Saldo insuficiente", status: 400 };
  }

  // Impedir palpite no lado oposto
  const oppositeSide = side === "sim" ? "nao" : "sim";
  const { data: existingOpposite } = await supabase
    .from("community_bets")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("side", oppositeSide)
    .not("status", "in", '("refunded","lost")')
    .limit(1);

  if (existingOpposite && existingOpposite.length > 0) {
    return { error: `Você já palpitou ${oppositeSide.toUpperCase()} neste evento.`, status: 400 };
  }

  // Calc odds
  const { data: stats } = await supabase
    .from("v_community_event_stats")
    .select("volume_sim, volume_nao")
    .eq("event_id", eventId)
    .single();

  const volSim = ((stats as any)?.volume_sim ?? 0) + (side === "sim" ? amount : 0);
  const volNao = ((stats as any)?.volume_nao ?? 0) + (side === "nao" ? amount : 0);
  const { simOdds, naoOdds } = calcOdds(volSim, volNao);
  const estimatedOdds = side === "sim" ? simOdds : naoOdds;

  // Debitar saldo (trava otimista via CAS)
  const debit = await debitBalance(supabase, userId, amount);
  if (!debit.ok) {
    return { error: debit.reason === "insufficient" ? "Saldo insuficiente" : "Erro ao debitar saldo. Tente novamente.", status: debit.reason === "insufficient" ? 400 : 409 };
  }

  const { data: bet, error: betError } = await supabase
    .from("community_bets")
    .insert({
      event_id: eventId,
      user_id: userId,
      side,
      amount,
      locked_odds: estimatedOdds,
      status: "matched",
      potential_payout: parseFloat((amount * estimatedOdds).toFixed(2)),
    })
    .select()
    .single();

  if (betError) {
    await creditBalance(supabase, userId, amount);
    return { error: "Erro ao registrar palpite", status: 500 };
  }

  await supabase.from("transactions").insert({
    user_id: userId,
    type: "bet_placed",
    amount,
    net_amount: amount,
    description: `Palpite ${side.toUpperCase()} — Comunidade`,
    reference_id: eventId,
  });

  // Update event counters
  const { data: evStats } = await supabase
    .from("v_community_event_stats")
    .select("total_volume, bet_count")
    .eq("event_id", eventId)
    .single();

  await supabase
    .from("community_events")
    .update({
      total_volume: evStats?.total_volume ?? amount,
      participant_count: evStats?.bet_count ?? 1,
    })
    .eq("id", eventId);

  return {
    success: true,
    bet_id: bet.id,
    estimated_odds: estimatedOdds,
  };
}

// ── Payout da Comunidade ────────────────────────────────────────

const CREATOR_COMMISSION_RATE = 0.02; // 2% de recompensa pro criador que resolve honestamente
const PLATFORM_COMMISSION_RATE = 0; // sem comissão de plataforma

export async function pagarComunidade(
  supabase: any,
  eventId: string,
  resolution: "sim" | "nao"
) {
  const { data: event } = await supabase
    .from("community_events")
    .select("title, creator_id")
    .eq("id", eventId)
    .single();

  const title = event?.title?.slice(0, 55) ?? "Evento";

  const { data: allBets } = await supabase
    .from("community_bets")
    .select("*")
    .eq("event_id", eventId)
    .not("status", "in", '("refunded","won","lost")');

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.side === resolution);
  const loserBets = bets.filter((b: any) => b.side !== resolution);

  // Sem cobertura — reembolsa todos
  if (winnerBets.length === 0 || loserBets.length === 0) {
    await reembolsarComunidade(supabase, eventId, "Sem palpites no lado oposto");
    return { note: "no_coverage_refund" };
  }

  const totalPool = bets.reduce((s: number, b: any) => s + b.amount, 0);
  const totalCommission = totalPool * (CREATOR_COMMISSION_RATE + PLATFORM_COMMISSION_RATE);
  const creatorCommission = totalPool * CREATOR_COMMISSION_RATE;
  const distributablePool = totalPool - totalCommission;

  const totalWinPool = winnerBets.reduce((s: number, b: any) => s + b.amount, 0);

  // Batch payouts: aggregate per user for single CAS credit per wallet
  const payouts = winnerBets.map((bet: any) => {
    const share = bet.amount / totalWinPool;
    const payout = parseFloat((share * distributablePool).toFixed(2));
    return { bet, payout };
  });

  const creditos = somarPorUsuario(payouts.map((w: any) => ({ user_id: w.bet.user_id, valor: w.payout })));
  const failedCredits: string[] = [];
  await emLotes(creditos, 10, async ([userId, total]) => {
    const r = await creditBalance(supabase, userId, total);
    if (!r.ok) failedCredits.push(`user=${userId} amount=${total} reason=${r.reason}`);
  });
  if (failedCredits.length > 0) {
    console.error(`[comunidade/pagarComunidade] creditBalance falhou ${failedCredits.length}:`, failedCredits.join("; "));
  }

  await emLotes(payouts, 10, ({ bet, payout }: any) =>
    supabase.from("community_bets").update({ status: "won", potential_payout: payout }).eq("id", bet.id)
  );

  const nowIso = new Date().toISOString();
  await supabase.from("transactions").insert(payouts.map(({ bet, payout }: any) => ({
    user_id: bet.user_id,
    type: "bet_won",
    amount: payout,
    net_amount: payout,
    description: `Ganhou ${resolution.toUpperCase()} — Comunidade "${title}"`,
    reference_id: eventId,
    created_at: nowIso,
  })));

  await supabase.from("notifications").insert(payouts.map(({ bet, payout }: any) => ({
    user_id: bet.user_id,
    type: "bet_won",
    title: "Você ganhou!",
    body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
    data: { community_event_id: eventId, payout },
    created_at: nowIso,
  })));

  for (const { bet, payout } of payouts) {
    sendPushToUser(supabase, bet.user_id, {
      title: "Você ganhou!",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(payout)}.`,
      url: `/comunidade/${eventId}`,
    }).catch(() => {});
  }

  if (loserBets.length > 0) {
    await supabase.from("community_bets").update({ status: "lost" }).in("id", loserBets.map((b: any) => b.id));
    await supabase.from("notifications").insert(loserBets.map((bet: any) => ({
      user_id: bet.user_id,
      type: "market_resolved",
      title: "Evento resolvido",
      body: `"${title}" foi resolvido como ${resolution.toUpperCase()}. Boa sorte na próxima!`,
      data: { community_event_id: eventId },
      created_at: nowIso,
    })));
  }

  // Pagar comissão ao criador
  if (event?.creator_id && creatorCommission > 0) {
    const commResult = await creditBalance(supabase, event.creator_id, creatorCommission);
    if (!commResult.ok) {
      console.error(`[comunidade/pagarComunidade] creditBalance comissão falhou user=${event.creator_id} amount=${creatorCommission} reason=${commResult.reason}`);
    }
    await supabase.from("transactions").insert({
      user_id: event.creator_id,
      type: "commission",
      amount: creatorCommission,
      net_amount: creatorCommission,
      description: `Comissão de criador — "${title}"`,
      reference_id: eventId,
      created_at: nowIso,
    });
  }

  // Salvar comissão no evento
  await supabase
    .from("community_events")
    .update({
      status: "community_resolved",
      resolution,
      resolved_at: new Date().toISOString(),
      creator_commission: creatorCommission,
    })
    .eq("id", eventId);

  return { note: "paid", creatorCommission };
}

export async function reembolsarComunidade(
  supabase: any,
  eventId: string,
  motivo: string
) {
  const { data: event } = await supabase
    .from("community_events")
    .select("title")
    .eq("id", eventId)
    .single();
  const title = event?.title?.slice(0, 55) ?? "Evento";

  const { data: bets } = await supabase
    .from("community_bets")
    .select("*")
    .eq("event_id", eventId)
    .not("status", "in", '("refunded","won","lost")');

  const allBets = bets ?? [];
  if (allBets.length === 0) return;

  const creditos = somarPorUsuario(allBets.map((b: any) => ({ user_id: b.user_id, valor: b.amount })));
  const failedCredits: string[] = [];
  await emLotes(creditos, 10, async ([userId, total]) => {
    const r = await creditBalance(supabase, userId, total);
    if (!r.ok) failedCredits.push(`user=${userId} amount=${total} reason=${r.reason}`);
  });
  if (failedCredits.length > 0) {
    console.error(`[comunidade/reembolsarComunidade] creditBalance falhou ${failedCredits.length}:`, failedCredits.join("; "));
  }

  await supabase.from("community_bets").update({ status: "refunded" }).in("id", allBets.map((b: any) => b.id));
  await supabase.from("transactions").insert(allBets.map((bet: any) => ({
    user_id: bet.user_id,
    type: "bet_refund",
    amount: bet.amount,
    net_amount: bet.amount,
    description: `Reembolso — ${motivo}`,
    reference_id: eventId,
  })));
}

// ── Estorno de payout (clawback verificado + log) ───────────────
//
// debitBalance é CAS e *recusa* deixar o saldo negativo: se o usuário já gastou
// o valor recebido, o débito do payout inteiro falha silenciosamente e a aposta
// acabaria sendo re-paga — criando Z$ do nada (quebra a regra 4 de conservação).
// Aqui debitamos o quanto for possível (clamp ao saldo disponível), verificamos
// o resultado e SEMPRE registramos uma transação de estorno, expondo qualquer
// déficit residual para auditoria em vez de escondê-lo.
async function estornarPayout(
  supabase: any,
  userId: string,
  valor: number,
  eventId: string,
) {
  if (valor <= 0) return;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const saldo = Number(wallet?.balance ?? 0);
  const estornavel = Math.min(valor, saldo);
  const deficit = parseFloat((valor - estornavel).toFixed(2));

  let cobrado = 0;
  if (estornavel > 0) {
    const res = await debitBalance(supabase, userId, estornavel);
    if (res.ok) cobrado = estornavel;
  }

  await supabase.from("transactions").insert({
    user_id: userId,
    type: "reversal",
    amount: cobrado,
    net_amount: -cobrado,
    description:
      deficit > 0
        ? `Estorno de resolução revertida (déficit não coberto: ${deficit.toFixed(2)})`
        : "Estorno de resolução revertida",
    reference_id: eventId,
  });

  if (deficit > 0) {
    console.error(
      `[reverterResolucao] estorno parcial — user ${userId}, devido ${valor}, cobrado ${cobrado}, déficit ${deficit}`,
    );
  }
}

// ── Reverter resolução (contestação aceita) ─────────────────────

export async function reverterResolucao(supabase: any, eventId: string, novaResolucao: "sim" | "nao") {
  // Reverter todos os payouts anteriores
  const { data: wonBets } = await supabase
    .from("community_bets")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "won");

  for (const bet of wonBets ?? []) {
    const payout = Number(bet.potential_payout ?? bet.amount);
    await estornarPayout(supabase, bet.user_id, payout, eventId);
    await supabase.from("community_bets").update({ status: "matched" }).eq("id", bet.id);
  }

  // Reverter perdedores
  const { data: lostBets } = await supabase
    .from("community_bets")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "lost");

  for (const bet of lostBets ?? []) {
    await supabase.from("community_bets").update({ status: "matched" }).eq("id", bet.id);
  }

  // Reverter comissão do criador
  const { data: event } = await supabase
    .from("community_events")
    .select("creator_id, creator_commission")
    .eq("id", eventId)
    .single();

  if (event?.creator_id && event.creator_commission > 0) {
    await estornarPayout(supabase, event.creator_id, Number(event.creator_commission), eventId);
  }

  // Marcar como reversed e re-pagar com novo resultado
  await supabase
    .from("community_events")
    .update({ status: "reversed", resolution: null, creator_commission: 0 })
    .eq("id", eventId);

  // Agora pagar com a resolução correta
  return pagarComunidade(supabase, eventId, novaResolucao);
}
