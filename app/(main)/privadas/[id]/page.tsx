export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import PrivateBetRoom from "@/components/apostas-privadas/PrivateBetRoom";

interface PageProps { params: Promise<{ id: string }> }

export default async function PrivadaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [
    { data: topic, error: topicError },
    { data: sides },
    { data: participants },
    { data: stats },
  ] = await Promise.all([
    admin.from("topics").select("*, creator:profiles!creator_id(username)").eq("id", id).single(),
    admin.from("topic_sides").select("*, leader:profiles(id, username, created_at)").eq("topic_id", id),
    admin.from("topic_participants")
      .select("*, profile:profiles!topic_participants_user_id_fkey(id, username, full_name, avatar_url, created_at)")
      .eq("topic_id", id),
    admin.from("v_topic_stats").select("*").eq("topic_id", id).single(),
  ]);

  if (topicError && topicError.code !== "PGRST116") {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-red-400 font-semibold">Erro ao carregar bolão</p>
        <p className="text-muted-foreground text-xs font-mono">{topicError.message}</p>
      </div>
    );
  }

  if (!topic) notFound();

  const myParticipant = participants?.find((p: any) => p.user_id === user.id) ?? null;
  const isCreator = topic.creator_id === user.id;

  if (!myParticipant && !isCreator) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Você não tem acesso a este bolão.</p>
      </div>
    );
  }

  return (
    <PrivateBetRoom
      topic={topic}
      sides={sides ?? []}
      participants={participants ?? []}
      stats={stats ?? null}
      currentUserId={user.id}
      myParticipant={myParticipant}
    />
  );
}
