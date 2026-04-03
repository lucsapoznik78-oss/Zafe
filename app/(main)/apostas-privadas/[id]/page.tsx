export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import PrivateBetRoom from "@/components/apostas-privadas/PrivateBetRoom";

interface PageProps { params: Promise<{ id: string }> }

export default async function ApostaPrivadaPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Use admin client for reads to bypass RLS — access control is done below
  const admin = createAdminClient();

  const [
    { data: topic, error: topicError },
    { data: sides },
    { data: participants },
    { data: nominations },
  ] = await Promise.all([
    admin.from("topics").select("*, creator:profiles!creator_id(username)").eq("id", id).single(),
    admin.from("topic_sides").select("*, leader:profiles(id, username, created_at)").eq("topic_id", id),
    admin.from("topic_participants")
      .select("*, profile:profiles(id, username, avatar_url, created_at)")
      .eq("topic_id", id),
    admin.from("judge_nominations")
      .select("*, judge:profiles(id, username)")
      .eq("topic_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (topicError && topicError.code !== "PGRST116") {
    // PGRST116 = not found, anything else is a real error
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-red-400 font-semibold">Erro ao carregar aposta</p>
        <p className="text-muted-foreground text-xs font-mono">{topicError.message}</p>
      </div>
    );
  }

  if (!topic) notFound();

  // Access control: must be participant (any status) or nominated judge
  const myParticipant = participants?.find((p: any) => p.user_id === user.id) ?? null;
  const isJudge = nominations?.some(
    (n: any) => n.judge_user_id === user.id
  ) ?? false;

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
    const { data: votes } = await admin
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
    const { data: jv } = await admin
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
