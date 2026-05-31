import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { fecharVotacao } from "@/lib/private-bets";
import { pagarVencedores } from "@/lib/payout";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { vote } = await req.json(); // 'sim' | 'nao'
  if (!["sim", "nao"].includes(vote)) {
    return NextResponse.json({ error: "Voto inválido" }, { status: 400 });
  }

  const { data: topic } = await supabase
    .from("topics")
    .select("private_phase, judge_vote_deadline, judge_id, status, closes_at")
    .eq("id", topicId)
    .single();

  if (!topic) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });

  // ── Modelo simples (sem fases): o juiz único decide direto ──────────────
  if (!topic.private_phase) {
    if (topic.judge_id !== user.id) {
      return NextResponse.json({ error: "Apenas o juiz pode definir o resultado" }, { status: 403 });
    }
    if (topic.status === "resolved" || topic.status === "cancelled") {
      return NextResponse.json({ error: "Bolão já encerrado" }, { status: 400 });
    }
    if (topic.status !== "active" && (!topic.closes_at || new Date(topic.closes_at) > new Date())) {
      return NextResponse.json({ error: "O bolão ainda não pode ser resolvido" }, { status: 400 });
    }

    const admin = createAdminClient();
    await pagarVencedores(admin, topicId, vote);
    await admin.from("topics").update({
      status: "resolved",
      resolution: vote,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq("id", topicId);

    // Notificar participantes aceitos
    const { data: members } = await admin
      .from("topic_participants")
      .select("user_id")
      .eq("topic_id", topicId)
      .eq("status", "accepted");

    const notifs = (members ?? [])
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({
        user_id: m.user_id,
        type: "market_resolved",
        title: "Bolão resolvido",
        body: `O juiz definiu o resultado: ${vote.toUpperCase()}.`,
        data: { topic_id: topicId, resolution: vote },
      }));
    if (notifs.length > 0) await admin.from("notifications").insert(notifs);

    return NextResponse.json({ success: true, resolved: true });
  }

  // ── Modelo por fases: votação de múltiplos juízes ───────────────────────
  const isVoting = topic.private_phase === "voting" || topic.private_phase === "voting_round2";
  if (!isVoting) return NextResponse.json({ error: "Fora da fase de votação" }, { status: 400 });
  if (new Date(topic.judge_vote_deadline) < new Date()) {
    return NextResponse.json({ error: "Prazo de votação encerrado" }, { status: 400 });
  }

  const round = topic.private_phase === "voting" ? 1 : 2;

  // Verificar que é juiz ativo desta aposta
  const { data: myVoteRow } = await supabase
    .from("judge_outcome_votes")
    .select("id, voted_at")
    .eq("topic_id", topicId)
    .eq("judge_id", user.id)
    .eq("round", round)
    .single();

  if (!myVoteRow) return NextResponse.json({ error: "Você não é juiz desta aposta" }, { status: 403 });
  if (myVoteRow.voted_at) return NextResponse.json({ error: "Você já votou nesta rodada" }, { status: 400 });

  // Registrar voto
  await supabase.from("judge_outcome_votes").update({
    vote,
    voted_at: new Date().toISOString(),
  }).eq("topic_id", topicId).eq("judge_id", user.id).eq("round", round);

  // Verificar se todos os juízes já votaram → fechar imediatamente
  const { data: allVotes } = await supabase
    .from("judge_outcome_votes")
    .select("voted_at")
    .eq("topic_id", topicId)
    .eq("round", round);

  const todosVotaram = (allVotes ?? []).every((v: any) => v.voted_at !== null);
  if (todosVotaram) {
    await fecharVotacao(createAdminClient(), topicId, round);
  }

  return NextResponse.json({ success: true, todos_votaram: todosVotaram });
}
