export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, timeUntil } from "@/lib/utils";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: "Aguardando aprovação", class: "bg-yellow-500/20 text-yellow-300" },
  active: { label: "Ativo", class: "bg-sim/20 text-sim" },
  resolved: { label: "Resolvido", class: "bg-muted text-muted-foreground" },
  cancelled: { label: "Rejeitado", class: "bg-nao/20 text-nao" },
};

export default async function MeusTopicosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: topics } = await supabase
    .from("topics")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  const topicIds = (topics ?? []).map((t) => t.id);
  const { data: statsData } = topicIds.length
    ? await supabase.from("v_topic_stats").select("*").in("topic_id", topicIds)
    : { data: [] };
  const statsMap = new Map((statsData ?? []).map((s: any) => [s.topic_id, s]));
  const topicsWithStats = (topics ?? []).map((t) => ({ ...t, stats: statsMap.get(t.id) ?? null }));

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Tópicos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{topicsWithStats.length} tópicos criados</p>
        </div>
        <Link
          href="/criar"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Criar
        </Link>
      </div>

      {!topicsWithStats.length ? (
        <div className="text-center py-16">
          <p className="text-white font-medium mb-1">Nenhum tópico criado ainda</p>
          <p className="text-muted-foreground text-sm">Crie o primeiro investimento para a comunidade</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topicsWithStats.map((topic) => {
            const status = STATUS_LABELS[topic.status] ?? STATUS_LABELS.pending;
            const stats = topic.stats;
            return (
              <div key={topic.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge category={topic.category} />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${status.class}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeUntil(topic.closes_at)}</span>
                </div>
                <Link href={`/topicos/${topic.id}`} className="hover:text-primary transition-colors">
                  <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">{topic.title}</h3>
                </Link>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Volume: {formatCurrency(stats?.total_volume ?? 0)}</span>
                    <span>{stats?.bet_count ?? 0} investimentos</span>
                  </div>
                  {topic.status === "pending" && (
                    <Link
                      href={`/criar/editar/${topic.id}`}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <Pencil size={11} />
                      Editar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
