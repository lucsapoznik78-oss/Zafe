import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verificarLimiteAnual } from "@/lib/limits/private-bet-limit";

const FRIENDSHIP_MIN_HOURS = 24;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const {
    title, description, category, min_bet, closes_at,
    adversario_ids,
    judge_ids,
  } = await req.json();

  const numJudges = judge_ids?.length ?? 0;
  if (!title || !closes_at || !adversario_ids?.length || numJudges < 1 || numJudges > 7 || numJudges % 2 === 0) {
    return NextResponse.json({ error: "Número de juízes deve ser ímpar entre 1 e 7 (1, 3, 5 ou 7)" }, { status: 400 });
  }

  // Juiz não pode ser participante
  const allParticipants = [user.id, ...adversario_ids];
  const judgeConflict = judge_ids.some((jid: string) => allParticipants.includes(jid));
  if (judgeConflict) {
    return NextResponse.json({ error: "Juiz não pode ser participante da aposta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const betAmount = parseFloat(min_bet) || 1;

  // ── TRAVA 1: Só entre amigos confirmados há mais de 24h ─────────────────
  const limiteFriendship = new Date(Date.now() - FRIENDSHIP_MIN_HOURS * 60 * 60 * 1000).toISOString();
  for (const adversarioId of adversario_ids) {
    const { data: friendship } = await admin
      .from("friendships")
      .select("id, created_at")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${adversarioId}),and(requester_id.eq.${adversarioId},addressee_id.eq.${user.id})`
      )
      .lte("created_at", limiteFriendship)
      .single();

    if (!friendship) {
      return NextResponse.json(
        { error: "Só é possível criar apostas privadas com amigos confirmados há mais de 24 horas." },
        { status: 403 }
      );
    }
  }

  // ── TRAVA 4: Limite anual de Z$ por par ─────────────────────────────────
  for (const adversarioId of adversario_ids) {
    const check = await verificarLimiteAnual(admin, user.id, adversarioId, betAmount * 2);
    if (!check.ok) {
      return NextResponse.json({ error: check.mensagem }, { status: 403 });
    }
  }

  // Verificar saldo (auth client para RLS correto)
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < betAmount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Usar admin para todos os writes (sem RLS bloqueando)
  const recruitmentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const negotiationDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  // Criar o topic
  const { data: topic, error: topicErr } = await admin.from("topics").insert({
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
  await admin.from("topic_sides").insert([
    { topic_id: topic.id, side: "A" },
    { topic_id: topic.id, side: "B" },
  ]);

  // Criador entra como participante do Lado A (já aceito)
  await admin.from("topic_participants").insert({
    topic_id: topic.id, user_id: user.id,
    side: "A", status: "accepted",
    joined_at: new Date().toISOString(),
  });

  // Debitar aposta mínima do criador
  await admin.from("wallets").update({ balance: wallet.balance - betAmount }).eq("user_id", user.id);
  await admin.from("bets").insert({
    topic_id: topic.id, user_id: user.id,
    side: "sim", amount: betAmount,
    status: "pending", matched_amount: betAmount, unmatched_amount: 0,
    is_private: true,
  });
  await admin.from("transactions").insert({
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
  await admin.from("topic_participants").insert(bInvites);

  // Buscar perfil do criador
  const { data: creatorProfile } = await admin
    .from("profiles").select("username").eq("id", user.id).single();
  const creatorName = creatorProfile?.username ?? "Alguém";

  // Notificar adversários
  const bNotifs = adversario_ids.map((uid: string) => ({
    user_id: uid,
    type: "bet_invite",
    title: "Convite para aposta privada",
    body: `@${creatorName} te convidou para uma aposta: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "B" },
  }));
  await admin.from("notifications").insert(bNotifs);

  // Criar nomeações iniciais dos juízes
  const responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const judgeRows = judge_ids.map((jid: string) => ({
    topic_id: topic.id,
    judge_user_id: jid,
    proposed_by_side: "A",
    leader_a_approved: true,
    leader_b_approved: null,
    status: "proposed",
    response_deadline: responseDeadline,
  }));
  await admin.from("judge_nominations").insert(judgeRows);

  // Notificar juízes propostos
  const judgeNotifs = judge_ids.map((jid: string) => ({
    user_id: jid,
    type: "judge_invite",
    title: "Proposta de juiz",
    body: `@${creatorName} te propôs como juiz na aposta: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id },
  }));
  await admin.from("notifications").insert(judgeNotifs);

  return NextResponse.json({ success: true, topic_id: topic.id });
}
