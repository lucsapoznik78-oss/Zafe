import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Medal } from "lucide-react";

interface Props {
  concursoId: string;
}

const MEDAL_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600"];

export default async function RankingList({ concursoId }: Props) {
  const admin = createAdminClient();

  const { data: ranking } = await admin
    .from("v_concurso_ranking")
    .select("*")
    .eq("concurso_id", concursoId)
    .order("posicao", { ascending: true })
    .limit(50);

  if (!ranking || ranking.length === 0) {
    return (
      <div className="bg-card border border-yellow-400/20 rounded-xl p-8 text-center">
        <Medal size={32} className="mx-auto mb-2 text-yellow-400/40" />
        <p className="text-white font-medium mb-1">Ranking vazio</p>
        <p className="text-sm text-muted-foreground">Inscreva-se e faça seus primeiros palpites para aparecer aqui.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-yellow-400/20 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-yellow-400/10">
        <h3 className="text-sm font-semibold text-yellow-400">Ranking ao vivo</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Atualizado em tempo real conforme eventos são resolvidos</p>
      </div>
      <div className="divide-y divide-yellow-400/10">
        {ranking.map((row: any) => {
          const medalColor = Number(row.posicao) <= 3 ? MEDAL_COLORS[Number(row.posicao) - 1] : "text-muted-foreground";
          return (
            <div key={row.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-yellow-400/5 transition-colors">
              <span className={`w-6 text-sm font-bold ${medalColor} text-center`}>{row.posicao}º</span>
              <div className="flex-1 min-w-0">
                <Link href={`/u/${row.username}`} className="text-sm font-medium text-white hover:text-yellow-400 transition-colors truncate block">
                  {row.full_name ?? row.username}
                </Link>
                <p className="text-[11px] text-muted-foreground">
                  {row.palpites_ganhos}/{row.total_palpites} acertos
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-yellow-400">ZC$ {Number(row.balance).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                {Number(row.balance) > 1000 ? (
                  <p className="text-[10px] text-green-400">+ZC$ {(Number(row.balance) - 1000).toFixed(0)}</p>
                ) : Number(row.balance) < 1000 ? (
                  <p className="text-[10px] text-red-400">-ZC$ {(1000 - Number(row.balance)).toFixed(0)}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">ZC$ 0</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
