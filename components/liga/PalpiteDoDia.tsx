import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Flame } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import { formatCurrency } from "@/lib/utils";

/**
 * Destaque diário determinístico: o mesmo evento para todos os usuários
 * durante o dia (fuso de Brasília), escolhido entre os 10 ativos com mais
 * volume. Muda todo dia → motivo para voltar ao app.
 */
export default async function PalpiteDoDia() {
  const supabase = await createClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, category, slug, closes_at")
    .eq("status", "active")
    .eq("is_private", false)
    .is("concurso_id", null)
    .gte("closes_at", new Date().toISOString())
    .order("closes_at", { ascending: true })
    .limit(50);

  if (!topics?.length) return null;

  const { data: stats } = await supabase
    .from("v_topic_stats")
    .select("topic_id, total_volume, prob_sim, prob_nao")
    .in("topic_id", topics.map((t) => t.id));

  const statsMap = new Map((stats ?? []).map((s) => [s.topic_id, s]));

  // Top 10 por volume (com fallback para os que fecham primeiro)
  const candidates = [...topics]
    .sort((a, b) => (statsMap.get(b.id)?.total_volume ?? 0) - (statsMap.get(a.id)?.total_volume ?? 0))
    .slice(0, 10);

  // Seed = data de hoje em Brasília → escolha estável durante o dia inteiro
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  let seed = 0;
  for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = candidates[seed % candidates.length];

  const s = statsMap.get(pick.id);
  const probSim = Math.round(((s?.prob_sim as number) ?? 0.5) * 100);
  const probNao = 100 - probSim;
  const volume = (s?.total_volume as number) ?? 0;
  const href = `/liga/${pick.slug ?? pick.id}`;

  return (
    <Link href={href} className="block">
      <div className="relative overflow-hidden bg-card border border-primary/40 rounded-xl p-4 hover:border-primary/70 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 text-primary text-[11px] font-bold rounded-full uppercase tracking-wide">
            <Flame size={11} />
            Palpite do dia
          </span>
          <CategoryBadge category={pick.category} />
        </div>

        <p className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2 mb-3">
          {pick.title}
        </p>

        <div className="flex overflow-hidden rounded-md h-4 mb-1.5">
          <div
            className="bg-sim flex items-center justify-center text-[9px] font-bold text-black min-w-[28px]"
            style={{ width: `${probSim}%` }}
          >
            {probSim}%
          </div>
          <div
            className="bg-nao flex items-center justify-center text-[9px] font-bold text-white min-w-[28px]"
            style={{ width: `${probNao}%` }}
          >
            {probNao}%
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="text-sim font-semibold">SIM {probSim}%</span>
            {" · "}
            <span className="text-nao font-semibold">NÃO {probNao}%</span>
          </span>
          {volume > 0 && <span>{formatCurrency(volume)} em palpites</span>}
        </div>
      </div>
    </Link>
  );
}
