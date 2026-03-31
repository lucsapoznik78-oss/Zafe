import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { elegerLider, checkLideresEleitos } from "@/lib/private-bets";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { candidate_id } = await req.json();

  // Verificar participante e pegar seu lado
  const { data: me } = await supabase
    .from("topic_participants")
    .select("side")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .single();

  if (!me) return NextResponse.json({ error: "Você não é participante desta aposta" }, { status: 403 });

  // Verificar fase
  const { data: topic } = await supabase
    .from("topics").select("private_phase").eq("id", topicId).single();
  if (topic?.private_phase !== "leader_election") {
    return NextResponse.json({ error: "Não estamos na fase de eleição" }, { status: 400 });
  }

  // Candidato deve ser do mesmo lado
  const { data: candidate } = await supabase
    .from("topic_participants")
    .select("user_id")
    .eq("topic_id", topicId)
    .eq("user_id", candidate_id)
    .eq("side", me.side)
    .eq("status", "accepted")
    .single();

  if (!candidate) return NextResponse.json({ error: "Candidato inválido" }, { status: 400 });

  // Upsert do voto
  await supabase.from("leader_votes").upsert({
    topic_id: topicId,
    side: me.side,
    voter_id: user.id,
    candidate_id,
    voted_at: new Date().toISOString(),
  }, { onConflict: "topic_id,side,voter_id" });

  // Verificar se todos do lado já votaram → eleger imediatamente
  const { data: membersSide } = await supabase
    .from("topic_participants")
    .select("user_id")
    .eq("topic_id", topicId)
    .eq("side", me.side)
    .eq("status", "accepted");

  const { data: votesSide } = await supabase
    .from("leader_votes")
    .select("voter_id")
    .eq("topic_id", topicId)
    .eq("side", me.side);

  const allVoted = (membersSide?.length ?? 0) === (votesSide?.length ?? 0);

  if (allVoted) {
    await elegerLider(supabase, topicId, me.side as "A" | "B");
    await checkLideresEleitos(supabase, topicId);
  }

  return NextResponse.json({ success: true, all_voted: allVoted });
}
