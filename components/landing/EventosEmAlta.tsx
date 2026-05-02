import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { TopicWithStats } from "@/types/database";
import TopicCard from "@/components/topicos/TopicCard";
import { TrendingUp } from "lucide-react";

async function getTopTopics(): Promise<TopicWithStats[]> {
  try {
    const admin = createAdminClient();
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: topics } = await admin
      .from("topics")
      .select("*, creator:profiles!creator_id(id, username, full_name)")
      .eq("status", "active")
      .eq("is_private", false)
      .neq("category", "economia")
      .gt("closes_at", oneHourFromNow)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!topics || topics.length === 0) return [];

    const topicIds = topics.map((t) => t.id);
    const { data: statsData } = await admin
      .from("v_topic_stats")
      .select("*")
      .in("topic_id", topicIds);

    const statsMap = new Map((statsData ?? []).map((s: any) => [s.topic_id, s]));

    const enriched = topics
      .map((t) => ({ ...t, stats: statsMap.get(t.id) ?? null }))
      .sort((a, b) => (b.stats?.total_volume ?? 0) - (a.stats?.total_volume ?? 0))
      .slice(0, 4);

    return enriched as TopicWithStats[];
  } catch {
    return [];
  }
}

export default async function EventosEmAlta() {
  const topics = await getTopTopics();

  if (topics.length === 0) return null;

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Eventos em alta
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Previsões abertas agora mesmo — sem login pra ver.
            </p>
          </div>
          <Link
            href="/liga"
            className="hidden sm:inline-flex text-sm text-primary hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/liga/${topic.id}`} className="block">
              <TopicCard topic={topic} />
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/liga"
            className="inline-flex px-5 py-2.5 rounded-xl border border-border text-sm text-white font-medium hover:border-primary/40 transition-colors"
          >
            Ver todos os eventos →
          </Link>
        </div>
      </div>
    </section>
  );
}
