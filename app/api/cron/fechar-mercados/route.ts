import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushToMany } from "@/lib/webpush";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      authorized = profile?.is_admin === true;
    }
  }

  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  // Use admin client for all operations — cron has no user session and RLS would silently block writes
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Mover mercados públicos expirados para 'resolving' (apostas privadas são tratadas pelo outro cron)
  const { data: expiredTopics } = await supabase
    .from("topics")
    .select("id")
    .eq("status", "active")
    .eq("is_private", false)
    .lt("closes_at", now);

  for (const t of expiredTopics ?? []) {
    await supabase.from("topics").update({
      status: "resolving",
      oracle_retry_count: 0,
      oracle_next_retry_at: null,
    }).eq("id", t.id);
  }

  // Também reseta o retry de topics que estão presos em resolving (retry no futuro)
  // Garante que ao clicar o botão, todos os mercados pendentes sejam reprocessados agora
  await supabase
    .from("topics")
    .update({ oracle_next_retry_at: null })
    .eq("status", "resolving")
    .eq("is_private", false)
    .not("oracle_next_retry_at", "is", null);

  // Notificar apostadores + watchlist de mercados que fecham em ~2 horas
  const in2h = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const in1h50 = new Date(Date.now() + 110 * 60 * 1000).toISOString();

  const { data: closingSoon } = await supabase
    .from("topics")
    .select("id, title")
    .eq("status", "active")
    .eq("is_private", false)
    .gte("closes_at", in1h50)
    .lte("closes_at", in2h);

  for (const topic of closingSoon ?? []) {
    const [{ data: bettors }, { data: watchers }] = await Promise.all([
      supabase.from("bets").select("user_id").eq("topic_id", topic.id).in("status", ["pending", "matched"]),
      supabase.from("watchlist").select("user_id").eq("topic_id", topic.id).eq("notify_close", true),
    ]);

    const betIds  = new Set((bettors ?? []).map((b: any) => b.user_id));
    const allIds  = [...new Set([...betIds, ...(watchers ?? []).map((w: any) => w.user_id)])];

    if (allIds.length > 0) {
      sendPushToMany(supabase, allIds, {
        title: "Mercado fecha em 2h ⏳",
        body: `"${topic.title.slice(0, 60)}" — última chance de apostar.`,
        url: `/liga/${topic.id}`,
      }).catch(() => {});

      await supabase.from("notifications").insert(allIds.map((uid) => ({
        user_id: uid,
        type: "market_closing" as const,
        title: "Mercado fecha em 2h ⏳",
        body: `"${topic.title.slice(0, 60)}" — ${betIds.has(uid) ? "última chance de apostar ou vender sua posição" : "mercado que você segue"}.`,
        data: { topic_id: topic.id },
      })));
    }
  }

  // Tirar snapshot diário das odds para o gráfico de evolução
  const { data: activeTopics } = await supabase
    .from("topics")
    .select("id")
    .eq("status", "active")
    .gte("closes_at", now);

  let snapshotCount = 0;

  // Batch-fetch stats for all active topics at once
  const activeTopicIds = (activeTopics ?? []).map((t: any) => t.id);
  const { data: allTopicStats } = activeTopicIds.length > 0
    ? await supabase.from("v_topic_stats").select("topic_id, prob_sim, volume_sim, volume_nao").in("topic_id", activeTopicIds)
    : { data: [] };

  const probMap = new Map((allTopicStats ?? []).map((s: any) => [s.topic_id, parseFloat(s.prob_sim ?? "0.5")]));
  const statsByTopic = new Map((allTopicStats ?? []).map((s: any) => [s.topic_id, s]));

  for (const topic of activeTopics ?? []) {
    const stats = statsByTopic.get(topic.id);
    if (stats) {
      await supabase.from("topic_snapshots").insert({
        topic_id: topic.id,
        prob_sim: stats.prob_sim ?? 0.5,
        volume_sim: stats.volume_sim ?? 0,
        volume_nao: stats.volume_nao ?? 0,
        recorded_at: now,
      });
      snapshotCount++;
    }
  }

  // ── Watchlist: alertas de variação de probabilidade ──────────────────────────────
  const { data: watchlistEntries } = await supabase
    .from("watchlist")
    .select("id, user_id, topic_id, threshold_pct, last_notified_prob")
    .not("topic_id", "is", null);

  // Batch-fetch topic titles for watchlist alerts
  const watchlistTopicIds = [...new Set((watchlistEntries ?? []).map((e: any) => e.topic_id))];
  const { data: watchlistTopics } = watchlistTopicIds.length > 0
    ? await supabase.from("topics").select("id, title").in("id", watchlistTopicIds)
    : { data: [] };
  const titleMap = new Map((watchlistTopics ?? []).map((t: any) => [t.id, t.title]));

  for (const entry of watchlistEntries ?? []) {
    const currentProb = probMap.get(entry.topic_id) ?? null;
    if (currentProb === null) continue;
    const lastProb = entry.last_notified_prob ?? currentProb;
    const diff = Math.abs(currentProb - lastProb) * 100;
    if (diff >= entry.threshold_pct) {
      const title = titleMap.get(entry.topic_id) ?? "Mercado";
      const dir = currentProb > lastProb ? "subiu" : "caiu";
      await Promise.all([
        supabase.from("notifications").insert({
          user_id: entry.user_id,
          type: "watchlist_alert",
          title: `Probabilidade ${dir} ${diff.toFixed(0)}%`,
          body: `"${title.slice(0, 55)}" SIM agora em ${(currentProb * 100).toFixed(1)}%`,
          data: { topic_id: entry.topic_id },
        }),
        supabase.from("watchlist").update({ last_notified_prob: currentProb }).eq("id", entry.id),
      ]);
    }
  }

  return NextResponse.json({
    success: true,
    expired_topics: expiredTopics?.length ?? 0,
    snapshots_taken: snapshotCount,
  });
}
