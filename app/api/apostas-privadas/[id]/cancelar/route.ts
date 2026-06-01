/**
 * Criador cancela aposta privada durante recrutamento — reembolsa todos os participantes aceitos
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { creditBalance } from "@/lib/wallet";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: topic } = await admin
    .from("topics")
    .select("creator_id, private_phase, title, min_bet, status")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
  if (topic.creator_id !== user.id) return NextResponse.json({ error: "Apenas o criador pode cancelar" }, { status: 403 });

  // Modelo por fases: só cancelável durante recrutamento/eleição/negociação.
  // Modelo simples (private_phase nulo): cancelável enquanto ainda pendente.
  const cancellablePhase = ["recruiting", "leader_election", "judge_negotiation"].includes(topic.private_phase);
  const cancellableSimple = !topic.private_phase && topic.status === "pending";
  if (!cancellablePhase && !cancellableSimple) {
    return NextResponse.json({ error: "Não é possível cancelar nesta fase" }, { status: 400 });
  }

  // Buscar participantes aceitos para reembolsar
  const { data: accepted } = await admin
    .from("topic_participants")
    .select("user_id")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  // Reembolsar cada participante aceito
  for (const p of accepted ?? []) {
    await creditBalance(admin, p.user_id, topic.min_bet);
    await admin.from("transactions").insert({
        user_id: p.user_id,
        type: "refund",
        amount: topic.min_bet,
        net_amount: topic.min_bet,
        description: `Reembolso — bolão cancelado: ${topic.title?.slice(0, 40)}`,
        reference_id: topicId,
      });
    await admin.from("notifications").insert({
      user_id: p.user_id,
      type: "bet_invite",
      title: "Bolão cancelado",
      body: `O bolão "${topic.title?.slice(0, 50)}" foi cancelado. Seu valor foi reembolsado.`,
      data: { topic_id: topicId },
    });
  }

  // Cancelar bets e marcar topic como cancelado
  await admin.from("bets").update({ status: "cancelled" }).eq("topic_id", topicId);
  await admin.from("topics").update({ private_phase: "cancelled", status: "cancelled" }).eq("id", topicId);

  return NextResponse.json({ success: true });
}
