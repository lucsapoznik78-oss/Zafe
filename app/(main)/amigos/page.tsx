export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import FriendsList from "@/components/amigos/FriendsList";
import FriendSearch from "@/components/amigos/FriendSearch";
import BetInvites from "@/components/amigos/BetInvites";
import LigasSection from "@/components/ligas/LigasSection";
import LigaInvites from "@/components/ligas/LigaInvites";
import AmigosTabNav from "@/components/amigos/AmigosTabNav";
import JudgeSection from "@/components/amigos/JudgeSection";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AmigosPage({ searchParams }: PageProps) {
  const { tab = "amigos" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: sentFriendships },
    { data: receivedFriendships },
    { data: betInvites },
    { data: ligasRaw },
    { data: ligaInvites },
    { data: judgeNominations },
    { data: judgeActive },
  ] = await Promise.all([
    supabase
      .from("friendships")
      .select("*, addressee:profiles!addressee_id(id, username, full_name, avatar_url)")
      .eq("requester_id", user.id),
    supabase
      .from("friendships")
      .select("*, requester:profiles!requester_id(id, username, full_name, avatar_url)")
      .eq("addressee_id", user.id),
    supabase
      .from("private_bet_invites")
      .select("*, topic:topics(*), inviter:profiles!inviter_id(username, full_name)")
      .eq("invitee_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("liga_members")
      .select("liga_id, ligas(id, name, description, color, creator_id, liga_members(id, user_id, status, profiles(username, full_name)))")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("liga_members")
      .select("id, liga_id, ligas(name, color, description), invited_by_profile:profiles!invited_by(full_name, username)")
      .eq("user_id", user.id)
      .eq("status", "pending"),
    // Juiz: convites pendentes (both_approved — precisa confirmar disponibilidade)
    supabase
      .from("judge_nominations")
      .select("id, topic_id, status, availability_deadline, created_at, topic:topics(title, private_phase)")
      .eq("judge_user_id", user.id)
      .eq("status", "both_approved"),
    // Juiz: atualmente ativo como juiz
    supabase
      .from("judge_nominations")
      .select("id, topic_id, status, availability_deadline, created_at, topic:topics(title, private_phase)")
      .eq("judge_user_id", user.id)
      .eq("status", "active"),
  ]);

  const accepted = [
    ...(sentFriendships ?? []).filter((f) => f.status === "accepted").map((f) => f.addressee),
    ...(receivedFriendships ?? []).filter((f) => f.status === "accepted").map((f) => f.requester),
  ].filter(Boolean) as { id: string; username: string; full_name: string }[];

  const ligaMap = new Map<string, any>();
  for (const m of ligasRaw ?? []) {
    if (m.ligas && !ligaMap.has((m.ligas as any).id)) {
      ligaMap.set((m.ligas as any).id, {
        ...m.ligas,
        members: (m.ligas as any).liga_members ?? [],
      });
    }
  }
  const ligas = Array.from(ligaMap.values());

  const pendingJudgeCount = (judgeNominations ?? []).length;

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-0">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Amigos</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Invista contra ou junto com seus amigos</p>
      </div>

      {/* Tab nav */}
      <Suspense>
        <AmigosTabNav pendingJudge={pendingJudgeCount} />
      </Suspense>

      <div className="pt-6 space-y-6">
        {tab === "juiz" ? (
          <JudgeSection
            pendentes={(judgeNominations as any) ?? []}
            ativos={(judgeActive as any) ?? []}
          />
        ) : (
          <>
            {(ligaInvites?.length ?? 0) > 0 && (
              <LigaInvites invites={ligaInvites ?? []} />
            )}

            {(betInvites?.length ?? 0) > 0 && (
              <BetInvites invites={betInvites ?? []} />
            )}

            <FriendSearch currentUserId={user.id} />

            <LigasSection
              ligas={ligas}
              currentUserId={user.id}
              friends={accepted}
            />

            <FriendsList
              sent={sentFriendships ?? []}
              received={receivedFriendships ?? []}
              currentUserId={user.id}
            />
          </>
        )}
      </div>
    </div>
  );
}
