import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkRecrutamento } from "@/lib/private-bets";
import { verificarLimiteAnual } from "@/lib/limits/private-bet-limit";

const FRIENDSHIP_MIN_HOURS = 24;

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
  const { data: participant } = await supabase
    .from("topic_participants")
    .select("*")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  if (participant.status !== "invited") return NextResponse.json({ error: "Convite já processado" }, { status: 400 });

  // ── TRAVA 1: Amizade confirmada há mais de 24h com o criador ────────────
  const { data: topicCreator } = await supabase
    .from("topics")
    .select("creator_id")
    .eq("id", topicId)
    .single();

  if (topicCreator) {
    const limiteFriendship = new Date(Date.now() - FRIENDSHIP_MIN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: friendship } = await admin
      .from("friendships")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${topicCreator.creator_id}),and(requester_id.eq.${topicCreator.creator_id},addressee_id.eq.${user.id})`
      )
      .lte("created_at", limiteFriendship)
      .single();

    if (!friendship) {
      return NextResponse.json(
        { error: "Só é possível participar de apostas privadas com amigos confirmados há mais de 24 horas." },
        { status: 403 }
      );
    }
  }

  // Verificar topic
  const { data: topic } = await supabase
    .from("topics")
    .select("min_bet, private_phase, recruitment_deadline, title")
    .eq("id", topicId).single();

  if (!topic) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
  if (topic.private_phase !== "recruiting") {
    return NextResponse.json({ error: "Período de recrutamento encerrado" }, { status: 400 });
  }
  if (new Date(topic.recruitment_deadline) < new Date()) {
    return NextResponse.json({ error: "Prazo de recrutamento expirado" }, { status: 400 });
  }

  // Verificar saldo
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  const betAmount = topic.min_bet;
  if (!wallet || wallet.balance < betAmount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // ── TRAVA 4: Limite anual por par (joiner vs criador) ───────────────────
  if (topicCreator) {
    const check = await verificarLimiteAnual(admin, user.id, topicCreator.creator_id, betAmount);
    if (!check.ok) {
      return NextResponse.json({ error: check.mensagem }, { status: 403 });
    }
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
    description: `Aposta privada — ${topic.title?.slice(0, 40)}`,
    reference_id: topicId,
  });

  // Verificar se já há 5+ participantes para avançar de fase
  await checkRecrutamento(admin, topicId);

  return NextResponse.json({ success: true });
}
