import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";

const MIN_BET = 1;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { topic_id, side, amount } = await request.json();

  if (!topic_id || !["sim", "nao"].includes(side) || !amount) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Verificar tópico ativo e não expirado
  const { data: topic } = await supabase
    .from("topics")
    .select("status, closes_at, min_bet")
    .eq("id", topic_id)
    .single();

  if (!topic || topic.status !== "active") {
    return NextResponse.json({ error: "Tópico inválido ou encerrado" }, { status: 400 });
  }
  if (new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "O prazo para apostar neste mercado já encerrou" }, { status: 400 });
  }

  const effectiveMin = Math.max(MIN_BET, topic.min_bet ?? MIN_BET);
  if (amount < effectiveMin) {
    return NextResponse.json({ error: `Valor mínimo: Z$ ${effectiveMin},00` }, { status: 400 });
  }

  // Verificar saldo
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (!wallet || wallet.balance < amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Impedir aposta nos dois lados do mesmo tópico
  const oppositeSide = side === "sim" ? "nao" : "sim";
  const { data: existingOpposite } = await supabase
    .from("bets")
    .select("id")
    .eq("topic_id", topic_id)
    .eq("user_id", user.id)
    .eq("side", oppositeSide)
    .not("status", "in", '("refunded","lost")')
    .limit(1);

  if (existingOpposite && existingOpposite.length > 0) {
    return NextResponse.json({
      error: `Você já apostou ${oppositeSide.toUpperCase()} neste tópico.`,
    }, { status: 400 });
  }

  // Odds estimadas no momento (só para registro histórico)
  const { data: stats } = await supabase
    .from("v_topic_stats")
    .select("volume_sim, volume_nao")
    .eq("topic_id", topic_id)
    .single();

  const { simOdds, naoOdds } = calcOdds(
    (stats as any)?.volume_sim ?? 0,
    (stats as any)?.volume_nao ?? 0
  );
  const estimatedOdds = side === "sim" ? simOdds : naoOdds;

  // Debitar saldo (optimistic lock)
  const { error: walletError } = await supabase
    .from("wallets")
    .update({ balance: wallet.balance - amount })
    .eq("user_id", user.id)
    .eq("balance", wallet.balance);

  if (walletError) {
    return NextResponse.json({ error: "Erro ao debitar saldo. Tente novamente." }, { status: 409 });
  }

  // Inserir aposta no pool — sem matching, sem unmatched
  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      topic_id,
      user_id: user.id,
      side,
      amount,
      gross_amount: amount,
      locked_odds: estimatedOdds,
      status: "pending",
      matched_amount: amount,   // no sistema parimutual, tudo está "no pool"
      unmatched_amount: 0,
      potential_payout: parseFloat((amount * estimatedOdds).toFixed(2)),
      is_private: false,
    })
    .select()
    .single();

  if (betError) {
    await supabase.from("wallets").update({ balance: wallet.balance }).eq("user_id", user.id);
    return NextResponse.json({ error: "Erro ao registrar aposta" }, { status: 500 });
  }

  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "bet_placed",
    amount,
    net_amount: amount,
    description: `Aposta ${side.toUpperCase()} — odds estimadas ${estimatedOdds.toFixed(2)}x`,
    reference_id: topic_id,
  });

  // ── Matching automático parimutuel ──────────────────────────────
  // Se já existem apostas em ambos os lados → marcar TODAS como matched
  const oppSide = side === "sim" ? "nao" : "sim";
  const { count: oppCount } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topic_id)
    .eq("side", oppSide)
    .not("status", "in", '("refunded","exited","lost","won")');

  if ((oppCount ?? 0) > 0) {
    // Ambos os lados têm apostas → matchear tudo
    await supabase
      .from("bets")
      .update({ status: "matched" })
      .eq("topic_id", topic_id)
      .eq("status", "pending");

    // Notificar o apostador atual que foi matched
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "bet_matched",
      title: "Aposta confirmada! 🎯",
      body: `Sua aposta ${side.toUpperCase()} foi aceita — há apostadores do lado oposto.`,
      data: { topic_id },
    });
  }
  // ────────────────────────────────────────────────────────────────

  return NextResponse.json({
    success: true,
    bet_id: bet.id,
    estimated_odds: estimatedOdds,
    matched: (oppCount ?? 0) > 0,
  });
}
