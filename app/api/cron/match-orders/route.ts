/**
 * GET /api/cron/match-orders
 * Runs the matching engine for all open orders across all active topics.
 * Ensures orders from different users get matched even when no new order
 * triggered the matching engine.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { tryMatchOrders } from "@/lib/order-matching";

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find all open/partial orders sorted by oldest first so oldest orders
  // get matched first (price-time priority).
  const { data: openOrders } = await admin
    .from("orders")
    .select("id, topic_id")
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: true });

  if (!openOrders?.length) {
    return NextResponse.json({ matched: 0, message: "Nenhuma ordem aberta" });
  }

  let totalTrades = 0;

  // De-duplicate: only run matching once per topic to avoid redundant work.
  const seenTopics = new Set<string>();
  for (const order of openOrders) {
    if (seenTopics.has(order.topic_id)) continue;
    seenTopics.add(order.topic_id);

    // Run matching for each open order in this topic
    const topicOrders = openOrders.filter((o) => o.topic_id === order.topic_id);
    for (const o of topicOrders) {
      const result = await tryMatchOrders(admin, o.id);
      totalTrades += result.tradesExecuted;
    }
  }

  return NextResponse.json({ matched: totalTrades, topics_checked: seenTopics.size });
}
