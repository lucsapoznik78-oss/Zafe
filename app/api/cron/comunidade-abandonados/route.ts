import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { reembolsarComunidade, adjustReputation } from "@/lib/comunidade";

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Find events past resolution deadline
  const { data: abandoned } = await supabase
    .from("community_events")
    .select("id, creator_id, title")
    .eq("status", "awaiting_resolution")
    .lt("resolution_deadline", now);

  let processed = 0;
  for (const event of abandoned ?? []) {
    await reembolsarComunidade(supabase, event.id, "Criador não resolveu em 72h");
    await supabase
      .from("community_events")
      .update({ status: "auto_cancelled", resolved_at: now })
      .eq("id", event.id);

    // Penalize reputation: -5 for abandonment
    const { data: rep } = await supabase
      .from("creator_reputation")
      .select("events_abandoned, streak")
      .eq("user_id", event.creator_id)
      .single();

    const newAbandoned = (rep?.events_abandoned ?? 0) + 1;
    const blockUntil = newAbandoned >= 3
      ? new Date(Date.now() + 30 * 24 * 3600000).toISOString()
      : null;

    await adjustReputation(supabase, event.creator_id, -5, {
      events_abandoned: newAbandoned,
      streak: 0,
      ...(blockUntil ? { blocked_until: blockUntil } : {}),
    });

    // Notify creator
    await supabase.from("notifications").insert({
      user_id: event.creator_id,
      type: "market_resolved",
      title: "Evento cancelado",
      body: `"${event.title?.slice(0, 50)}" foi cancelado por falta de resolução. Nota -5.`,
      data: { community_event_id: event.id },
    });

    processed++;
  }

  return NextResponse.json({ processed });
}
