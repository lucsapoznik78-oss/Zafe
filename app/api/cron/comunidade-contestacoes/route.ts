import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { reverterResolucao, adjustReputation } from "@/lib/comunidade";

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Find contested events
  const { data: contested } = await supabase
    .from("community_events")
    .select("id, creator_id, title, resolution")
    .eq("status", "contested");

  let processed = 0;
  for (const event of contested ?? []) {
    // Move to under_review — admin will handle manually for now
    // In future: could auto-resolve with Claude AI triple check
    await supabase
      .from("community_events")
      .update({ status: "under_review" })
      .eq("id", event.id);

    // Notify admin
    await supabase.from("notifications").insert({
      user_id: event.creator_id,
      type: "market_resolved",
      title: "Evento sob revisão",
      body: `"${event.title?.slice(0, 50)}" foi contestado e está sob revisão.`,
      data: { community_event_id: event.id },
    });

    processed++;
  }

  // Also: close contestation window for resolved events past 48h
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: expired } = await supabase
    .from("community_events")
    .select("id")
    .eq("status", "community_resolved")
    .lt("resolved_at", cutoff);

  // These are final — no more contestations accepted (already enforced by API)
  // Refund pending contestation fees for events that passed without escalation
  for (const ev of expired ?? []) {
    const { data: pendingContestations } = await supabase
      .from("community_contestations")
      .select("id, user_id, fee_charged")
      .eq("event_id", ev.id)
      .eq("status", "pending");

    for (const c of pendingContestations ?? []) {
      // Mark as rejected (didn't reach threshold)
      await supabase
        .from("community_contestations")
        .update({ status: "rejected" })
        .eq("id", c.id);
      // Do NOT refund fee — contestation was below threshold
    }
  }

  return NextResponse.json({ processed, expired_checked: (expired ?? []).length });
}
