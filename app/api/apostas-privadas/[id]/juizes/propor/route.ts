/**
 * Líder propõe juízes substitutos durante negociação
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { judge_user_id, replaces_id } = await req.json();

  // Verificar que é líder
  const { data: side } = await supabase
    .from("topic_sides")
    .select("side, leader_id")
    .eq("topic_id", topicId)
    .eq("leader_id", user.id)
    .single();

  if (!side) return NextResponse.json({ error: "Apenas líderes podem propor juízes" }, { status: 403 });

  // Verificar fase
  const { data: topic } = await supabase
    .from("topics").select("private_phase, negotiation_deadline").eq("id", topicId).single();
  if (topic?.private_phase !== "judge_negotiation") {
    return NextResponse.json({ error: "Fora da fase de negociação" }, { status: 400 });
  }
  if (new Date(topic.negotiation_deadline) < new Date()) {
    return NextResponse.json({ error: "Prazo de negociação expirado" }, { status: 400 });
  }

  // Juiz não pode ser participante
  const { data: isParticipant } = await supabase
    .from("topic_participants")
    .select("id")
    .eq("topic_id", topicId)
    .eq("user_id", judge_user_id)
    .single();

  if (isParticipant) {
    return NextResponse.json({ error: "Juiz não pode ser participante da aposta" }, { status: 400 });
  }

  // Juiz não pode já estar ativo
  const { data: alreadyActive } = await supabase
    .from("judge_nominations")
    .select("id")
    .eq("topic_id", topicId)
    .eq("judge_user_id", judge_user_id)
    .in("status", ["proposed", "both_approved", "active"])
    .single();

  if (alreadyActive) {
    return NextResponse.json({ error: "Este juiz já está na negociação" }, { status: 400 });
  }

  const mySide = side.side;
  const responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("judge_nominations").insert({
    topic_id: topicId,
    judge_user_id,
    proposed_by_side: mySide,
    leader_a_approved: mySide === "A" ? true : null,
    leader_b_approved: mySide === "B" ? true : null,
    replaces_id: replaces_id ?? null,
    status: "proposed",
    response_deadline: responseDeadline,
  });

  // Notificar o outro líder
  const otherSide = mySide === "A" ? "B" : "A";
  const { data: otherLeaderSide } = await supabase
    .from("topic_sides").select("leader_id").eq("topic_id", topicId).eq("side", otherSide).single();

  if (otherLeaderSide?.leader_id) {
    const { data: judgeProfile } = await supabase
      .from("profiles").select("username").eq("id", judge_user_id).single();

    const notifBody = `Um novo juiz foi proposto: ${judgeProfile?.username ?? "usuário"}. Você tem 24h para responder.`;
    await supabase.from("notifications").insert({
      user_id: otherLeaderSide.leader_id,
      type: "bet_invite",
      title: "Novo juiz proposto",
      body: notifBody,
      data: { topic_id: topicId, phase: "judge_negotiation" },
    });
    sendPushToUser(supabase, otherLeaderSide.leader_id, {
      title: "Novo juiz proposto ⚖️",
      body: notifBody,
      url: `/apostas-privadas/${topicId}`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
