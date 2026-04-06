import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
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

  // Notificar apostadores de mercados que fecham em ~2 horas
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
    const { data: bettors } = await supabase
      .from("bets")
      .select("user_id")
      .eq("topic_id", topic.id)
      .in("status", ["pending", "matched"]);

    const uniqueIds = [...new Set((bettors ?? []).map((b: any) => b.user_id))];
    if (uniqueIds.length > 0) {
      sendPushToMany(supabase, uniqueIds, {
        title: "Mercado fecha em 2h ⏳",
        body: `"${topic.title.slice(0, 60)}" — última chance de apostar.`,
        url: `/topicos/${topic.id}`,
      }).catch(() => {});
    }
  }

  // Tirar snapshot diário das odds para o gráfico de evolução
  const { data: activeTopics } = await supabase
    .from("topics")
    .select("id")
    .eq("status", "active")
    .gte("closes_at", now);

  let snapshotCount = 0;

  for (const topic of activeTopics ?? []) {
    const { data: stats } = await supabase
      .from("v_topic_stats")
      .select("prob_sim, volume_sim, volume_nao")
      .eq("topic_id", topic.id)
      .single();

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

  return NextResponse.json({
    success: true,
    expired_topics: expiredTopics?.length ?? 0,
    snapshots_taken: snapshotCount,
  });
}
