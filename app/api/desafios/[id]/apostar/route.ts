import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { side, amount } = await req.json();
  if (side !== "sim" && side !== "nao") {
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Busca desafio
  const { data: desafio } = await admin
    .from("desafios").select("status, closes_at, min_bet, creator_id").eq("id", desafioId).single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  if (desafio.status !== "active") {
    return NextResponse.json({ error: "Este desafio não está mais aberto para apostas" }, { status: 400 });
  }
  if (new Date(desafio.closes_at) < new Date()) {
    return NextResponse.json({ error: "Prazo de apostas encerrado" }, { status: 400 });
  }

  // Criador não pode apostar no próprio desafio
  if (desafio.creator_id === user.id) {
    return NextResponse.json({ error: "Você não pode apostar no seu próprio desafio" }, { status: 400 });
  }

  if (amt < parseFloat(desafio.min_bet)) {
    return NextResponse.json({ error: `Aposta mínima: Z$ ${desafio.min_bet}` }, { status: 400 });
  }

  // Verifica saldo
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || parseFloat(wallet.balance) < amt) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Calcula odds atuais
  const { data: stats } = await admin
    .from("v_desafio_stats").select("volume_sim, volume_nao").eq("desafio_id", desafioId).single();
  const volSim = parseFloat(stats?.volume_sim ?? "0");
  const volNao = parseFloat(stats?.volume_nao ?? "0");
  const { simOdds, naoOdds } = calcOdds(volSim, volNao);
  const lockedOdds = side === "sim" ? simOdds : naoOdds;

  // Débito otimista
  const newBalance = parseFloat((parseFloat(wallet.balance) - amt).toFixed(2));
  const { error: walletErr } = await admin
    .from("wallets").update({ balance: newBalance }).eq("user_id", user.id).eq("balance", wallet.balance);
  if (walletErr) return NextResponse.json({ error: "Conflito de saldo, tente novamente" }, { status: 409 });

  // Registra transação
  await admin.from("transactions").insert({
    user_id: user.id, type: "bet_placed", amount: amt, net_amount: -amt,
    description: `Aposta ${side.toUpperCase()} — desafio`, reference_id: desafioId,
  });

  // Cria aposta
  const { data: bet, error: betErr } = await admin.from("desafio_bets").insert({
    desafio_id: desafioId,
    user_id: user.id,
    side,
    amount: amt,
    locked_odds: lockedOdds,
  }).select("id").single();

  if (betErr) {
    // Estorna saldo
    await admin.from("wallets").update({ balance: parseFloat(wallet.balance) }).eq("user_id", user.id);
    return NextResponse.json({ error: "Erro ao registrar aposta" }, { status: 500 });
  }

  return NextResponse.json({ id: bet.id, locked_odds: lockedOdds });
}
