import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Feed público da landing: atividade recente (anonimizada) + stats ao vivo
// dos tópicos em alta. Sem auth — só dados de tópicos públicos e ativos,
// username mascarado e sem valores de Z$.

function maskUsername(username: string | null): string {
  if (!username || username.length < 2) return "previsor";
  return username.slice(0, 2) + "***";
}

export async function GET(req: Request) {
  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? "";
  // UUIDs apenas — nunca interpolar input cru em filtros
  const ids = idsParam
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 12);

  const [betsRes, statsRes] = await Promise.all([
    admin
      .from("bets")
      .select(
        "id, side, created_at, topic:topics!inner(id, title, is_private, status), profile:profiles!user_id(username)"
      )
      .eq("topic.is_private", false)
      .eq("topic.status", "active")
      .order("created_at", { ascending: false })
      .limit(12),
    ids.length > 0
      ? admin.from("v_topic_stats").select("*").in("topic_id", ids)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const activity = (betsRes.data ?? []).map((b: any) => ({
    id: b.id,
    username: maskUsername(b.profile?.username ?? null),
    side: b.side as string | null,
    topic_id: b.topic?.id as string,
    topic_title: b.topic?.title as string,
    created_at: b.created_at as string,
  }));

  return NextResponse.json({ activity, stats: statsRes.data ?? [] });
}
