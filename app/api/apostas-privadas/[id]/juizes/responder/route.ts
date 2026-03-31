/**
 * Líder aceita ou rejeita uma nomeação de juiz
 * Se rejeitar e não tiver substituto → rejeição ignorada (aceite automático)
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkJuizesConfirmados } from "@/lib/private-bets";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nomination_id, aceitar, substituto_id } = await req.json();
  // aceitar: boolean — se false e substituto_id nulo → rejeição ignorada

  // Verificar que é líder e pegar o lado
  const { data: mySideData } = await supabase
    .from("topic_sides")
    .select("side")
    .eq("topic_id", topicId)
    .eq("leader_id", user.id)
    .single();

  if (!mySideData) return NextResponse.json({ error: "Apenas líderes podem responder" }, { status: 403 });

  const mySide = mySideData.side as "A" | "B";

  // Verificar fase
  const { data: topic } = await supabase
    .from("topics").select("private_phase").eq("id", topicId).single();
  if (topic?.private_phase !== "judge_negotiation") {
    return NextResponse.json({ error: "Fora da fase de negociação" }, { status: 400 });
  }

  // Buscar nomeação
  const { data: nom } = await supabase
    .from("judge_nominations")
    .select("*")
    .eq("id", nomination_id)
    .eq("topic_id", topicId)
    .eq("status", "proposed")
    .single();

  if (!nom) return NextResponse.json({ error: "Nomeação não encontrada" }, { status: 404 });

  // Verificar se é a vez deste lado responder
  const pendente = mySide === "A" ? nom.leader_a_approved === null : nom.leader_b_approved === null;
  if (!pendente) {
    return NextResponse.json({ error: "Seu lado já respondeu esta nomeação" }, { status: 400 });
  }

  const approvalField = mySide === "A" ? "leader_a_approved" : "leader_b_approved";

  if (aceitar || !substituto_id) {
    // Aceita (ou rejeição ignorada por falta de substituto)
    const update: any = { [approvalField]: true };

    // Verificar se o outro lado também já aprovou
    const otherApproved = mySide === "A" ? nom.leader_b_approved === true : nom.leader_a_approved === true;

    if (otherApproved) {
      // Ambos aprovaram → availability_pending
      update.status = "both_approved";
      update.availability_deadline = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      // Notificar o juiz para confirmar disponibilidade
      await supabase.from("notifications").insert({
        user_id: nom.judge_user_id,
        type: "bet_invite",
        title: "Você foi escolhido como juiz!",
        body: "Ambos os lados aprovaram você como juiz. Confirme sua disponibilidade em até 12h.",
        data: { topic_id: topicId, nomination_id, phase: "judge_confirmation" },
      });
    }

    await supabase.from("judge_nominations").update(update).eq("id", nomination_id);

  } else {
    // Rejeição com substituto
    await supabase.from("judge_nominations").update({
      [approvalField]: false,
      status: "rejected",
    }).eq("id", nomination_id);

    // Verificar que substituto não é participante
    const { data: isParticipant } = await supabase
      .from("topic_participants")
      .select("id")
      .eq("topic_id", topicId)
      .eq("user_id", substituto_id)
      .single();

    if (isParticipant) {
      return NextResponse.json({ error: "Substituto não pode ser participante" }, { status: 400 });
    }

    const responseDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("judge_nominations").insert({
      topic_id: topicId,
      judge_user_id: substituto_id,
      proposed_by_side: mySide,
      leader_a_approved: mySide === "A" ? true : null,
      leader_b_approved: mySide === "B" ? true : null,
      replaces_id: nomination_id,
      status: "proposed",
      response_deadline: responseDeadline,
    });

    // Notificar o outro líder
    const otherSide = mySide === "A" ? "B" : "A";
    const { data: otherLeader } = await supabase
      .from("topic_sides").select("leader_id").eq("topic_id", topicId).eq("side", otherSide).single();

    if (otherLeader?.leader_id) {
      await supabase.from("notifications").insert({
        user_id: otherLeader.leader_id,
        type: "bet_invite",
        title: "Juiz rejeitado — novo proposto",
        body: "Um juiz foi rejeitado e substituído. Avalie o novo candidato.",
        data: { topic_id: topicId, phase: "judge_negotiation" },
      });
    }
  }

  // Verificar se já há 3 juízes com both_approved → confirmar disponibilidade
  // (checkJuizesConfirmados vai verificar se há 3 'active')
  await checkJuizesConfirmados(supabase, topicId);

  return NextResponse.json({ success: true });
}
