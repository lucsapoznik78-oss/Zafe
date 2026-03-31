/**
 * Juiz confirma ou recusa disponibilidade após ser aprovado pelos 2 líderes
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

  if (new Date(nom.availability_deadline) < new Date()) {
    // Prazo expirado — auto-recusa tratada pelo cron, mas se chegou aqui recusa mesmo
    await supabase.from("judge_nominations").update({ status: "declined" }).eq("id", nomination_id);
    return NextResponse.json({ error: "Prazo de confirmação expirado" }, { status: 400 });
  }

  if (disponivel) {
    await supabase.from("judge_nominations").update({ status: "active" }).eq("id", nomination_id);
    await checkJuizesConfirmados(supabase, topicId);
    return NextResponse.json({ success: true, confirmado: true });
  } else {
    // Recusa → notificar líderes para propor substituto
    await supabase.from("judge_nominations").update({ status: "declined" }).eq("id", nomination_id);

    const { data: sides } = await supabase
      .from("topic_sides").select("leader_id").eq("topic_id", topicId);

    const { data: judgeProfile } = await supabase
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
      await supabase.from("notifications").insert(notifs);
    }

    // Voltar para negociação
    await supabase.from("topics").update({
      private_phase: "judge_negotiation",
    }).eq("id", topicId);

    return NextResponse.json({ success: true, confirmado: false });
  }
}
