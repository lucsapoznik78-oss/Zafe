import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";
import type { SupabaseClient } from "@supabase/supabase-js";
import { debitBalance, creditBalance } from "@/lib/wallet";

/** Core palpitar logic shared by /api/apostar and /api/liga|economico/[id]/palpitar */
export async function executePalpitar(
  supabase: SupabaseClient,
  userId: string,
  topic_id: string,
  side: string,
  amount: number,
) {
  if (!["sim", "nao"].includes(side) || !amount || amount <= 0) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { data: topic } = await supabase
    .from("topics")
    .select("status, closes_at, min_bet")
    .eq("id", topic_id)
    .single();

  if (!topic || topic.status !== "active") {
    return NextResponse.json({ error: "Tópico inválido ou encerrado" }, { status: 400 });
  }
  if (new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "O prazo para palpitar neste setor já encerrou" }, { status: 400 });
  }

  const effectiveMin = Math.max(1, topic.min_bet ?? 1);
  if (amount < effectiveMin) {
    return NextResponse.json({ error: `Valor mínimo: Z$ ${effectiveMin},00` }, { status: 400 });
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!wallet || wallet.balance < amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const oppositeSide = side === "sim" ? "nao" : "sim";
  const { data: existingOpposite } = await supabase
    .from("bets")
    .select("id")
    .eq("topic_id", topic_id)
    .eq("user_id", userId)
    .eq("side", oppositeSide)
    .not("status", "in", '("refunded","lost")')
    .limit(1);

  if (existingOpposite && existingOpposite.length > 0) {
    return NextResponse.json({
      error: `Você já palpitou ${oppositeSide.toUpperCase()} neste setor.`,
    }, { status: 400 });
  }

  const { data: stats } = await supabase
    .from("v_topic_stats")
    .select("volume_sim, volume_nao")
    .eq("topic_id", topic_id)
    .single();

  const volSim = ((stats as any)?.volume_sim ?? 0) + (side === "sim" ? amount : 0);
  const volNao = ((stats as any)?.volume_nao ?? 0) + (side === "nao" ? amount : 0);
  const { simOdds, naoOdds } = calcOdds(volSim, volNao);
  const estimatedOdds = side === "sim" ? simOdds : naoOdds;

  const debit = await debitBalance(supabase, userId, amount);
  if (!debit.ok) {
    return NextResponse.json(
      { error: debit.reason === "insufficient" ? "Saldo insuficiente" : "Erro ao debitar saldo. Tente novamente." },
      { status: debit.reason === "insufficient" ? 400 : 409 },
    );
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      topic_id,
      user_id: userId,
      side,
      amount,
      gross_amount: amount,
      locked_odds: estimatedOdds,
      status: "pending",
      matched_amount: amount,
      unmatched_amount: 0,
      potential_payout: parseFloat((amount * estimatedOdds).toFixed(2)),
      is_private: false,
    })
    .select()
    .single();

  if (betError) {
    await creditBalance(supabase, userId, amount);
    return NextResponse.json({ error: "Erro ao registrar palpite" }, { status: 500 });
  }

  await supabase.from("transactions").insert({
    user_id: userId,
    type: "bet_placed",
    amount,
    net_amount: amount,
    description: `Palpite ${side.toUpperCase()} — probabilidade estimada ${(1 / estimatedOdds * 100).toFixed(0)}%`,
    reference_id: topic_id,
  });

  // Parimutuel matching: se há palpites dos dois lados, marcar todos como matched
  const oppSide = side === "sim" ? "nao" : "sim";
  const { count: oppCount } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topic_id)
    .eq("side", oppSide)
    .not("status", "in", '("refunded","exited","lost","won")');

  if ((oppCount ?? 0) > 0) {
    await supabase
      .from("bets")
      .update({ status: "matched" })
      .eq("topic_id", topic_id)
      .eq("status", "pending");

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "bet_matched",
      title: "Palpite confirmado!",
      body: `Seu palpite ${side.toUpperCase()} foi aceito — há previsores do lado oposto.`,
      data: { topic_id },
    });
  }

  return NextResponse.json({
    success: true,
    bet_id: bet.id,
    estimated_odds: estimatedOdds,
    matched: (oppCount ?? 0) > 0,
  });
}
