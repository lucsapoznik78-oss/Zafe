import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Get all active community events
  const { data: events } = await supabase
    .from("community_events")
    .select("id")
    .in("status", ["active", "awaiting_resolution"]);

  if (!events || events.length === 0) {
    return NextResponse.json({ snapshots: 0 });
  }

  const eventIds = events.map((e) => e.id);
  const { data: stats } = await supabase
    .from("v_community_event_stats")
    .select("*")
    .in("event_id", eventIds);

  const snapshots = (stats ?? []).map((s: any) => ({
    event_id: s.event_id,
    prob_sim: s.prob_sim ?? 0.5,
    volume_sim: s.volume_sim ?? 0,
    volume_nao: s.volume_nao ?? 0,
  }));

  if (snapshots.length > 0) {
    await supabase.from("community_snapshots").insert(snapshots);
  }

  return NextResponse.json({ snapshots: snapshots.length });
}
