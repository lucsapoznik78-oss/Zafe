import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = createAdminClient();

  // Busca o tópico ativo com mais volume apostado
  const { data: topic } = await admin
    .from("v_topic_stats")
    .select("topic_id, total_volume, prob_sim, prob_nao")
    .gt("total_volume", 0)
    .order("total_volume", { ascending: false })
    .limit(1)
    .single();

  if (!topic) return NextResponse.json(null);

  const { data: topicData } = await admin
    .from("topics")
    .select("id, title, category, closes_at, slug")
    .eq("id", topic.topic_id)
    .eq("status", "active")
    .single();

  if (!topicData) return NextResponse.json(null);

  return NextResponse.json({
    ...topicData,
    prob_sim: topic.prob_sim,
    prob_nao: topic.prob_nao,
    total_volume: topic.total_volume,
  });
}
