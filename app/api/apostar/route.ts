import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";

const MIN_BET = 1;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { topic_id, side, outcome_id, amount } = await request.json();

  if (!topic_id || !amount) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Verificar tópico ativo e não expirado
  const { data: topic } = await supabase
    .from("topics")
    .select("status, closes_at, min_bet, market_type")
    .eq("id", topic_id)
    .single();

  const isMulti = topic?.market_type === "multi";

  if (!isMulti && !["sim", "nao"].includes(side)) {
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
  }
  if (isMulti && !outcome_id) {
    return NextResponse.json({ error: "Selecione um resultado" }, { status: 400 });
  }

  if (!topic || topic.status !== "active") {
    return NextResponse.json({ error: "Tópico inválido ou encerrado" }, { status: 400 });
  }
  if (new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "O prazo para palpitar neste evento já encerrou" }, { status: 400 });
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

  // Binário: impedir aposta no lado oposto
  // Multi: impedir qualquer segunda aposta (só 1 outcome por usuário)
  if (!isMulti) {
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
        error: `Você já palpitou ${oppositeSide.toUpperCase()} neste evento.`,
      }, { status: 400 });
    }
  } else {
    const { data: existingMulti } = await supabase
      .from("bets")
      .select("id")
      .eq("topic_id", topic_id)
      .eq("user_id", user.id)
      .not("status", "in", '("refunded","lost")')
      .limit(1);

    if (existingMulti && existingMulti.length > 0) {
      return NextResponse.json({
        error: "Você já fez um palpite neste evento. Só é permitido um palpite por evento.",
      }, { status: 400 });
    }
  }

  // Odds estimadas
  let estimatedOdds = 1;
  if (isMulti) {
    // Para multi: busca pool do outcome escolhido e total
    const { data: outcomes } = await supabase
      .from("topic_outcomes")
      .select("id, pool")
      .eq("topic_id", topic_id);
    const totalPool = (outcomes ?? []).reduce((s: number, o: any) => s + Number(o.pool), 0) + amount;
    const outcomePool = ((outcomes ?? []).find((o: any) => o.id === outcome_id)?.pool ?? 0) + amount;
    estimatedOdds = outcomePool > 0 ? totalPool / outcomePool : 1;
  } else {
    const { data: stats } = await supabase
      .from("v_topic_stats")
      .select("volume_sim, volume_nao")
      .eq("topic_id", topic_id)
      .single();
    const volSim = ((stats as any)?.volume_sim ?? 0) + (side === "sim" ? amount : 0);
    const volNao = ((stats as any)?.volume_nao ?? 0) + (side === "nao" ? amount : 0);
    const { simOdds, naoOdds } = calcOdds(volSim, volNao);
    estimatedOdds = side === "sim" ? simOdds : naoOdds;
  }

  // Debitar saldo (optimistic lock)
  const { error: walletError } = await supabase
    .from("wallets")
    .update({ balance: wallet.balance - amount })
    .eq("user_id", user.id)
    .eq("balance", wallet.balance);

  if (walletError) {
    return NextResponse.json({ error: "Erro ao debitar saldo. Tente novamente." }, { status: 409 });
  }

  // Inserir aposta no pool
  const betPayload: Record<string, any> = {
    topic_id,
    user_id: user.id,
    amount,
    gross_amount: amount,
    locked_odds: estimatedOdds,
    status: "pending",
    matched_amount: amount,
    unmatched_amount: 0,
    potential_payout: parseFloat((amount * estimatedOdds).toFixed(2)),
    is_private: false,
  };
  if (isMulti) {
    betPayload.outcome_id = outcome_id;
  } else {
    betPayload.side = side;
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert(betPayload)
    .select()
    .single();

  if (betError) {
    await supabase.from("wallets").update({ balance: wallet.balance }).eq("user_id", user.id);
    return NextResponse.json({ error: "Erro ao registrar palpite" }, { status: 500 });
  }

  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "bet_placed",
    amount,
    net_amount: amount,
    description: isMulti
      ? `Palpite multi — cotação estimada ${estimatedOdds.toFixed(2)}x`
      : `Palpite ${(side as string).toUpperCase()} — cotação estimada ${estimatedOdds.toFixed(2)}x`,
    reference_id: topic_id,
  });

  // ── Matching automático parimutuel ──────────────────────────────
  if (isMulti) {
    // Multi: matched imediatamente (pool parimutuel com N lados)
    await supabase.from("bets").update({ status: "matched" }).eq("id", bet.id);
    // Atualizar pool do outcome
    const { data: curOutcome } = await supabase
      .from("topic_outcomes").select("pool").eq("id", outcome_id).single();
    await supabase.from("topic_outcomes")
      .update({ pool: (Number(curOutcome?.pool ?? 0) + amount) })
      .eq("id", outcome_id);
  } else {
    // Binário: matched quando há apostas no lado oposto
    const oppSide = side === "sim" ? "nao" : "sim";
    const { count: oppCount } = await supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic_id)
      .eq("side", oppSide)
      .not("status", "in", '("refunded","exited","lost","won")');

    if ((oppCount ?? 0) > 0) {
      await supabase.from("bets").update({ status: "matched" })
        .eq("topic_id", topic_id).eq("status", "pending");
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "bet_matched",
        title: "Palpite confirmado! 🎯",
        body: `Seu palpite ${side.toUpperCase()} foi aceito — há previsores do lado oposto.`,
        data: { topic_id },
      });
    }
  }
  // ────────────────────────────────────────────────────────────────

  return NextResponse.json({
    success: true,
    bet_id: bet.id,
    estimated_odds: estimatedOdds,
  });
}
