import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Move expired active events to awaiting_resolution
  const { data: expired } = await supabase
    .from("community_events")
    .select("id, creator_id, title")
    .eq("status", "active")
    .lt("closes_at", now);

  let moved = 0;
  for (const event of expired ?? []) {
    const deadline = new Date(Date.now() + 72 * 3600000).toISOString();
    await supabase
      .from("community_events")
      .update({ status: "awaiting_resolution", resolution_deadline: deadline })
      .eq("id", event.id);

    // Notify creator
    await supabase.from("notifications").insert({
      user_id: event.creator_id,
      type: "market_resolved",
      title: "Resolva seu evento!",
      body: `"${event.title?.slice(0, 50)}" fechou. Resolva em até 72h.`,
      data: { community_event_id: event.id },
    });
    moved++;
  }

  return NextResponse.json({ moved });
}
