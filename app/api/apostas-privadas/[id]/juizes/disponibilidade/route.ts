/**
 * Juiz confirma ou recusa disponibilidade após ser aprovado pelos 2 líderes
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
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

  const { nomination_id, disponivel } = await req.json();

  // Verificar que é o juiz desta nomeação
  const { data: nom } = await supabase
    .from("judge_nominations")
    .select("*")
    .eq("id", nomination_id)
    .eq("topic_id", topicId)
    .eq("judge_user_id", user.id)
    .eq("status", "both_approved")
    .single();

  if (!nom) return NextResponse.json({ error: "Nomeação não encontrada" }, { status: 404 });

  // judge_nominations/topics/topic_sides passaram a ser service-role-only
  // (audit F-09). A autorização é o filtro acima (judge_user_id = user.id e
  // status both_approved), que garante que quem responde é o próprio juiz.
  // O admin também é necessário para notificar os LÍDERES: o RLS de
  // notifications barra inserir para outro user_id.
  const admin = createAdminClient();

  if (new Date(nom.availability_deadline) < new Date()) {
    // Prazo expirado — auto-recusa tratada pelo cron, mas se chegou aqui recusa mesmo
    await admin.from("judge_nominations").update({ status: "declined" }).eq("id", nomination_id);
    return NextResponse.json({ error: "Prazo de confirmação expirado" }, { status: 400 });
  }

  if (disponivel) {
    await admin.from("judge_nominations").update({ status: "active" }).eq("id", nomination_id);
    await checkJuizesConfirmados(admin, topicId);
    return NextResponse.json({ success: true, confirmado: true });
  } else {
    // Recusa → notificar líderes para propor substituto
    await admin.from("judge_nominations").update({ status: "declined" }).eq("id", nomination_id);

    const { data: sides } = await admin
      .from("topic_sides").select("leader_id").eq("topic_id", topicId);

    const { data: judgeProfile } = await admin
      .from("profiles").select("username").eq("id", user.id).single();

    const notifs = (sides ?? [])
      .filter((s: any) => s.leader_id)
      .map((s: any) => ({
        user_id: s.leader_id,
        type: "bet_invite",
        title: "Juiz recusou",
        body: `${judgeProfile?.username ?? "Um juiz"} recusou o papel. Proponha um substituto.`,
        data: { topic_id: topicId, phase: "judge_negotiation" },
      }));

    if (notifs.length > 0) {
      await admin.from("notifications").insert(notifs);
    }

    // Voltar para negociação
    await admin.from("topics").update({
      private_phase: "judge_negotiation",
    }).eq("id", topicId);

    return NextResponse.json({ success: true, confirmado: false });
  }
}
