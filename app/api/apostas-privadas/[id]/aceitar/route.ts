import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = createAdminClient();

  // Verificar convite pendente
  const { data: participant, error: pErr } = await supabase
    .from("topic_participants")
    .select("*")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .single();

  if (pErr || !participant) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  if (participant.status !== "invited") return NextResponse.json({ error: "Convite já processado" }, { status: 400 });

  const { data: topicCreator } = await admin
    .from("topics")
    .select("creator_id, min_bet, title")
    .eq("id", topicId)
    .single();

  if (!topicCreator) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });

  const isJudge = participant.side === "J";

  if (!isJudge) {
    // Verificar saldo para participantes apostadores
    const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    const betAmount = topicCreator.min_bet;
    if (!wallet || wallet.balance < betAmount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Aceitar convite
    await admin.from("topic_participants").update({
      status: "accepted",
      joined_at: new Date().toISOString(),
    }).eq("topic_id", topicId).eq("user_id", user.id);

    // Criar aposta mínima
    const betSide = participant.side === "A" ? "sim" : "nao";
    await admin.from("bets").insert({
      topic_id: topicId, user_id: user.id,
      side: betSide, amount: betAmount,
      status: "pending", matched_amount: betAmount, unmatched_amount: 0,
      is_private: true,
    });

    // Debitar saldo
    await admin.from("wallets").update({ balance: wallet.balance - betAmount }).eq("user_id", user.id);
    await admin.from("transactions").insert({
      user_id: user.id, type: "bet_placed",
      amount: betAmount, net_amount: betAmount,
      description: `Aposta privada — ${topicCreator.title?.slice(0, 40)}`,
      reference_id: topicId,
    });
  } else {
    // Juiz: apenas aceitar, sem apostar
    await admin.from("topic_participants").update({
      status: "accepted",
      joined_at: new Date().toISOString(),
    }).eq("topic_id", topicId).eq("user_id", user.id);
  }

  // ── Verificar se topic deve ativar (juiz aceito + ≥1 adversário aceito) ──
  const { data: accepted } = await admin
    .from("topic_participants")
    .select("side, status")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  const judgeAccepted = (accepted ?? []).some((p) => p.side === "J");
  const adversaryAccepted = (accepted ?? []).some((p) => p.side === "B");

  if (judgeAccepted && adversaryAccepted) {
    await admin.from("topics").update({ status: "active" }).eq("id", topicId).eq("status", "pending");
  }

  return NextResponse.json({ success: true });
}
