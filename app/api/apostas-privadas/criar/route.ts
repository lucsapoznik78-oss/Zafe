import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { debitBalance, creditBalance } from "@/lib/wallet";
import { verificarLimiteAnual } from "@/lib/limits/private-bet-limit";

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

  if (betAmount <= 0) {
    return NextResponse.json({ error: "Valor mínimo deve ser positivo" }, { status: 400 });
  }

  // Impedir auto-aposta
  if (adversario_ids.includes(user.id) || aliadoIds.includes(user.id)) {
    return NextResponse.json({ error: "Você não pode se incluir como adversário ou aliado" }, { status: 400 });
  }
  if (judge_id === user.id) {
    return NextResponse.json({ error: "O criador não pode ser o próprio juiz" }, { status: 400 });
  }

  // Verificar saldo (auth client para RLS correto)
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < betAmount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Verificar limite anual Z$ por par de usuários (CMN 5.298/2026)
  for (const adversarioId of adversario_ids) {
    const limite = await verificarLimiteAnual(admin, user.id, adversarioId, betAmount);
    if (!limite.ok) {
      return NextResponse.json({ error: limite.mensagem }, { status: 400 });
    }
  }

  // Debitar aposta mínima do criador ANTES de criar o bolão (trava otimista).
  // Feito antes da criação do topic para que uma corrida perdida não deixe
  // um bolão órfão sem o débito correspondente.
  const debit = await debitBalance(admin, user.id, betAmount);
  if (!debit.ok) {
    return NextResponse.json(
      { error: debit.reason === "insufficient" ? "Saldo insuficiente" : "Erro ao debitar saldo. Tente novamente." },
      { status: debit.reason === "insufficient" ? 400 : 409 },
    );
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
    // Reverter o débito já efetuado para não reter Z$ do criador
    await creditBalance(admin, user.id, betAmount);
    return NextResponse.json({ error: "Erro ao criar bolão" }, { status: 500 });
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

  // (saldo já debitado de forma atômica acima)
  await admin.from("bets").insert({
    topic_id: topic.id, user_id: user.id,
    side: "sim", amount: betAmount,
    status: "pending", matched_amount: betAmount, unmatched_amount: 0,
    is_private: true,
  });
  await admin.from("transactions").insert({
    user_id: user.id, type: "bet_placed",
    amount: betAmount, net_amount: betAmount,
    description: `Bolão — ${title.slice(0, 40)}`,
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
    title: "Convite para bolão",
    body: `@${creatorName} te convidou como aliado: "${title.slice(0, 50)}"`,
    data: { topic_id: topic.id, side: "A" },
  }));
  if (aNotifs.length > 0) await admin.from("notifications").insert(aNotifs);

  // Notificar adversários
  const bNotifs = adversario_ids.map((uid: string) => ({
    user_id: uid,
    type: "bet_invite",
    title: "Convite para bolão",
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
