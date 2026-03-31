export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import PrivateBetRoom from "@/components/apostas-privadas/PrivateBetRoom";

interface PageProps { params: Promise<{ id: string }> }

export default async function ApostaPrivadaPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: topic },
    { data: sides },
    { data: participants },
    { data: nominations },
    { data: myParticipant },
  ] = await Promise.all([
    supabase.from("topics").select("*, creator:profiles!creator_id(username)").eq("id", id).single(),
    supabase.from("topic_sides").select("*, leader:profiles(id, username, created_at)").eq("topic_id", id),
    supabase.from("topic_participants")
      .select("*, profile:profiles(id, username, avatar_url, created_at)")
      .eq("topic_id", id),
    supabase.from("judge_nominations")
      .select("*, judge:profiles(id, username)")
      .eq("topic_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("topic_participants").select("side, status").eq("topic_id", id).eq("user_id", user.id).single(),
  ]);

  if (!topic) notFound();

  // Verificar se o usuário tem acesso (participante ou convite pendente)
  const isJudge = nominations?.some(
    (n: any) => n.judge_user_id === user.id && ["both_approved", "active"].includes(n.status)
  );

  if (!myParticipant && !isJudge) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Você não tem acesso a esta aposta privada.</p>
      </div>
    );
  }

  // Votes para eleição (se estiver na fase correta)
  let leaderVotes: any[] = [];
  if (topic.private_phase === "leader_election" && myParticipant) {
    const { data: votes } = await supabase
      .from("leader_votes")
      .select("candidate_id")
      .eq("topic_id", id)
      .eq("side", myParticipant.side);
    leaderVotes = votes ?? [];
  }

  // Votos dos juízes (se estiver em fase de votação)
  let judgeVotes: any[] = [];
  if (["voting", "voting_round2"].includes(topic.private_phase ?? "")) {
    const round = topic.private_phase === "voting" ? 1 : 2;
    const { data: jv } = await supabase
      .from("judge_outcome_votes")
      .select("judge_id, vote, voted_at")
      .eq("topic_id", id)
      .eq("round", round);
    judgeVotes = jv ?? [];
  }

  return (
    <PrivateBetRoom
      topic={topic}
      sides={sides ?? []}
      participants={participants ?? []}
      nominations={nominations ?? []}
      leaderVotes={leaderVotes}
      judgeVotes={judgeVotes}
      currentUserId={user.id}
      myParticipant={myParticipant}
      isJudge={isJudge ?? false}
    />
  );
}
