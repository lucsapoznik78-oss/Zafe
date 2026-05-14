import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const {
    title, description, category, min_bet, closes_at,
    aliado_ids,
    adversario_ids,
    judge_id,
  } = await req.json();

  const aliadoIds = aliado_ids ?? [];

  if (!title || !closes_at || !adversario_ids?.length || !judge_id) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
  }

  const admin = createAdminClient();
  const betAmount = parseFloat(min_bet) || 1;

  // Verificar saldo (auth client para RLS correto)
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < betAmount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Criar o topic — pendente até juiz + ≥1 adversário aceitarem
  const { data: topic, error: topicErr } = await admin.from("topics").insert({
    creator_id: user.id,
    title, description, category,
    min_bet: betAmount,
    closes_at,
    status: "pending",
    is_private: true,
    judge_id,
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

  // Convidar aliados (Lado A)
  if (aliadoIds.length > 0) {
    const aInvites = aliadoIds.map((uid: string) => ({
      topic_id: topic.id, user_id: uid,
      side: "A", status: "invited",
      invited_by: user.id,
    }));
    await admin.from("topic_participants").insert(aInvites);
  }

  // Convidar adversários (Lado B)
  const bInvites = adversario_ids.map((uid: string) => ({
    topic_id: topic.id, user_id: uid,
    side: "B", status: "invited",
    invited_by: user.id,
  }));
  await admin.from("topic_participants").insert(bInvites);

  // Convidar juiz (Lado J)
  await admin.from("topic_participants").insert({
    topic_id: topic.id, user_id: judge_id,
    side: "J", status: "invited",
    invited_by: user.id,
  });

  // Buscar perfil do criador
  const { data: creatorProfile } = await admin
    .from("profiles").select("username").eq("id", user.id).single();
  const creatorName = creatorProfile?.username ?? "Alguém";

  // Notificar aliados
  const aNotifs = aliadoIds.map((uid: string) => ({
    user_id: uid,
    type: "bet_invite",
    title: "Convite para aposta privada",
    body: `@${creatorName} te convidou como aliado: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "A" },
  }));
  if (aNotifs.length > 0) await admin.from("notifications").insert(aNotifs);

  // Notificar adversários
  const bNotifs = adversario_ids.map((uid: string) => ({
    user_id: uid,
    type: "bet_invite",
    title: "Convite para aposta privada",
    body: `@${creatorName} te convidou como adversário: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "B" },
  }));
  await admin.from("notifications").insert(bNotifs);

  // Notificar juiz
  await admin.from("notifications").insert({
    user_id: judge_id,
    type: "bet_invite",
    title: "Convite para ser juiz",
    body: `@${creatorName} te convidou como juiz do bolão: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "J" },
  });

  return NextResponse.json({ success: true, topic_id: topic.id });
}
