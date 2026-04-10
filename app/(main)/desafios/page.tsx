export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Plus, Clock } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";

export const metadata = { title: "Desafios — Zafe" };

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:             { label: "Aberto",               cls: "bg-sim/20 text-sim" },
  awaiting_proof:     { label: "Aguard. prova",        cls: "bg-yellow-500/20 text-yellow-400" },
  proof_submitted:    { label: "Prova enviada",        cls: "bg-yellow-500/20 text-yellow-400" },
  under_contestation: { label: "Em contestação",       cls: "bg-orange-500/20 text-orange-400" },
  admin_review:       { label: "Revisão admin",        cls: "bg-purple-500/20 text-purple-400" },
  resolved:           { label: "Resolvido",            cls: "bg-muted text-muted-foreground" },
  cancelled:          { label: "Cancelado",            cls: "bg-nao/20 text-nao" },
};

export default async function DesafiosPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: desafios } = await admin
    .from("desafios")
    .select("id, title, category, status, closes_at, creator_id, profiles!creator_id(username, full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: statsRows } = await admin
    .from("v_desafio_stats")
    .select("desafio_id, total_volume, bet_count, prob_sim");

  const statsMap = new Map((statsRows ?? []).map((s: any) => [s.desafio_id, s]));

  return (
    <div className="py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Desafios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Micro-mercados criados pela comunidade
          </p>
        </div>
        <Link
          href="/desafios/criar"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Criar
        </Link>
      </div>

      {/* Lista */}
      {(!desafios || desafios.length === 0) ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">Nenhum desafio ainda.</p>
          <Link href="/desafios/criar" className="text-primary text-sm mt-2 inline-block hover:underline">
            Seja o primeiro a criar um!
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {desafios.map((d: any) => {
            const stats = statsMap.get(d.id);
            const totalVolume = parseFloat(stats?.total_volume ?? "0");
            const probSim = parseFloat(stats?.prob_sim ?? "0.5") * 100;
            const creator = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
            const creatorName = creator?.username ?? creator?.full_name ?? "Anônimo";
            const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.active;
            const isExpired = d.status === "active" && new Date(d.closes_at) < new Date();
            const effectiveBadge = isExpired ? STATUS_BADGE.awaiting_proof : badge;
            const isClosed = d.status !== "active" || isExpired;

            return (
              <Link key={d.id} href={`/desafios/${d.id}`}>
                <div className="bg-card border border-border rounded-xl p-4 hover:border-border/80 hover:bg-card/80 transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <CategoryBadge category={d.category} />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${effectiveBadge.cls}`}>
                          {effectiveBadge.label}
                        </span>
                      </div>
                      <p className="text-white font-medium text-sm leading-snug">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">por @{creatorName}</p>
                    </div>
                    {/* Stats */}
                    <div className="text-right shrink-0">
                      {totalVolume > 0 ? (
                        <>
                          <p className="text-xs text-white font-semibold">{formatCurrency(totalVolume)}</p>
                          <p className="text-[10px] text-muted-foreground">vol</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem apostas</p>
                      )}
                    </div>
                  </div>

                  {/* Barra de probabilidade */}
                  {totalVolume > 0 && (
                    <div className="mt-3">
                      <div className="flex h-1.5 rounded-full overflow-hidden">
                        <div className="bg-sim transition-all" style={{ width: `${probSim}%` }} />
                        <div className="bg-nao flex-1" />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span className="text-sim">SIM {probSim.toFixed(0)}%</span>
                        <span className="text-nao">NÃO {(100 - probSim).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {!isClosed && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                      <Clock size={10} />
                      <span>Encerra {new Date(d.closes_at).toLocaleString("pt-BR")}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
