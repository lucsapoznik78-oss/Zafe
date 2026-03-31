import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const {
    title, description, category, min_bet, closes_at,
    adversario_ids, // string[] — IDs dos usuários do lado B
    judge_ids,       // string[3] — IDs dos 3 juízes propostos
  } = await req.json();

  if (!title || !closes_at || !adversario_ids?.length || judge_ids?.length !== 3) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Juiz não pode ser participante
  const allParticipants = [user.id, ...adversario_ids];
  const judgeConflict = judge_ids.some((jid: string) => allParticipants.includes(jid));
  if (judgeConflict) {
    return NextResponse.json({ error: "Juiz não pode ser participante da aposta" }, { status: 400 });
  }

  // Verificar saldo
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  const betAmount = parseFloat(min_bet) || 1;
  if (!wallet || wallet.balance < betAmount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const recruitmentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const negotiationDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  // Criar o topic
  const { data: topic, error: topicErr } = await supabase.from("topics").insert({
    creator_id: user.id,
    title, description, category,
    min_bet: betAmount,
    closes_at,
    status: "pending",
    is_private: true,
    private_phase: "recruiting",
    recruitment_deadline: recruitmentDeadline,
    negotiation_deadline: negotiationDeadline,
    min_participants: 5,
  }).select().single();

  if (topicErr || !topic) {
    return NextResponse.json({ error: "Erro ao criar aposta" }, { status: 500 });
  }

  // Criar lados A e B
  await supabase.from("topic_sides").insert([
    { topic_id: topic.id, side: "A" },
    { topic_id: topic.id, side: "B" },
  ]);

  // Criador entra como participante do Lado A (já aceito)
  await supabase.from("topic_participants").insert({
    topic_id: topic.id, user_id: user.id,
    side: "A", status: "accepted",
    joined_at: new Date().toISOString(),
  });

  // Debitar aposta mínima do criador
  await supabase.from("wallets").update({ balance: wallet.balance - betAmount }).eq("user_id", user.id);
  await supabase.from("bets").insert({
    topic_id: topic.id, user_id: user.id,
    side: "sim", amount: betAmount,
    status: "pending", matched_amount: betAmount, unmatched_amount: 0,
    is_private: true,
  });
  await supabase.from("transactions").insert({
    user_id: user.id, type: "bet_placed",
    amount: betAmount, net_amount: betAmount,
    description: `Aposta privada — ${title.slice(0, 40)}`,
    reference_id: topic.id,
  });

  // Convidar adversários (Lado B)
  const bInvites = adversario_ids.map((uid: string) => ({
    topic_id: topic.id, user_id: uid,
    side: "B", status: "invited",
    invited_by: user.id,
  }));
  await supabase.from("topic_participants").insert(bInvites);

  // Notificar adversários
  const { data: creatorProfile } = await supabase
    .from("profiles").select("username").eq("id", user.id).single();
  const bNotifs = adversario_ids.map((uid: string) => ({
    user_id: uid,
    type: "bet_invite",
    title: "Convite para aposta privada",
    body: `${creatorProfile?.username ?? "Alguém"} te convidou para uma aposta: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "B" },
  }));
  await supabase.from("notifications").insert(bNotifs);

  // Criar nomeações iniciais dos juízes (propostos pelo Lado A)
  const responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const judgeRows = judge_ids.map((jid: string) => ({
    topic_id: topic.id,
    judge_user_id: jid,
    proposed_by_side: "A",
    leader_a_approved: true,  // criador propõe = já aprova
    leader_b_approved: null,  // aguarda lado B
    status: "proposed",
    response_deadline: responseDeadline,
  }));
  await supabase.from("judge_nominations").insert(judgeRows);

  return NextResponse.json({ success: true, topic_id: topic.id });
}
