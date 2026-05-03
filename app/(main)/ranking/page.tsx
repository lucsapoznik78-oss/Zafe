export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ranking",
  description: "Veja os melhores previsores do Zafe. Ranking de acertos, lucros e performance na liga de previsões.",
  openGraph: {
    title: "Ranking — Zafe",
    description: "Veja os melhores previsores do Zafe. Ranking de acertos, lucros e performance.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Ranking — Zafe",
    description: "Veja os melhores previsores do Zafe.",
  },
};
import { formatCurrency } from "@/lib/utils";
import { Trophy, TrendingUp, Medal } from "lucide-react";
import Link from "next/link";
import RankingFilters from "@/components/ranking/RankingFilters";

// Mínimo de apostas resolvidas para aparecer no ranking — evita contas com 1 acerto de sorte
const MIN_BETS = 3;

interface PageProps {
  searchParams: Promise<{ periodo?: string }>;
}

export default async function RankingPage({ searchParams }: PageProps) {
  const { periodo = "todos" } = await searchParams;
  const supabase = await createClient();

  // Definir janela de tempo
  const desde: string | null =
    periodo === "semana"
      ? new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
      : periodo === "mes"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  // Excluir admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  const adminIds = (admins ?? []).map((a: any) => a.id);

  // Buscar apostas resolvidas
  let query = supabase
    .from("bets")
    .select("user_id, amount, potential_payout, status")
    .in("status", ["won", "lost"]);

  if (adminIds.length > 0) {
    query = query.not("user_id", "in", `(${adminIds.join(",")})`);
  }
  if (desde) {
    query = query.gte("created_at", desde);
  }

  const { data: bets } = await query;

  // Agregar por usuário
  const statsMap = new Map<string, {
    wins: number; losses: number;
    lucro: number; volume: number;
  }>();

  for (const bet of bets ?? []) {
    const s = statsMap.get(bet.user_id) ?? { wins: 0, losses: 0, lucro: 0, volume: 0 };
    s.volume += bet.amount;
    if (bet.status === "won") {
      s.wins++;
      s.lucro += (bet.potential_payout ?? 0) - bet.amount;
    } else {
      s.losses++;
      s.lucro -= bet.amount;
    }
    statsMap.set(bet.user_id, s);
  }

  // Filtrar mínimo de apostas e ordenar por lucro
  const userIds = Array.from(statsMap.entries())
    .filter(([, s]) => s.wins + s.losses >= MIN_BETS)
    .sort((a, b) => b[1].lucro - a[1].lucro)
    .map(([id]) => id);

  // Buscar perfis
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const ranking = userIds
    .map((id, index) => {
      const s = statsMap.get(id)!;
      const p = profileMap.get(id);
      const total = s.wins + s.losses;
      return {
        pos: index + 1,
        id,
        username: p?.username ?? "—",
        full_name: p?.full_name ?? "—",
        wins: s.wins,
        losses: s.losses,
        total,
        winRate: total > 0 ? (s.wins / total) * 100 : 0,
        lucro: s.lucro,
        volume: s.volume,
      };
    });

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={22} className="text-primary" />
          Ranking de Preditores
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Mínimo {MIN_BETS} palpites resolvidos para aparecer · Ordenado por lucro líquido
        </p>
      </div>

      <RankingFilters periodo={periodo} />

      {ranking.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
          <Trophy size={32} className="text-muted-foreground mx-auto" />
          <p className="text-white font-semibold">Nenhum preditor ainda</p>
          <p className="text-sm text-muted-foreground">
            Faça pelo menos {MIN_BETS} palpites resolvidos para entrar no ranking.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((r) => (
            <Link
              key={r.id}
              href={`/u/${r.username}`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
            >
              {/* Posição */}
              <div className="w-8 text-center shrink-0">
                {r.pos === 1 ? (
                  <Medal size={20} className="text-yellow-400 mx-auto" />
                ) : r.pos === 2 ? (
                  <Medal size={20} className="text-slate-400 mx-auto" />
                ) : r.pos === 3 ? (
                  <Medal size={20} className="text-amber-600 mx-auto" />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">#{r.pos}</span>
                )}
              </div>

              {/* Nome */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">@{r.username}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">Acertos</p>
                  <p className="text-sm font-semibold text-white">
                    {r.winRate.toFixed(0)}%
                    <span className="text-xs text-muted-foreground ml-1">({r.wins}/{r.total})</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(r.volume)}</p>
                </div>
                <div className="w-24">
                  <p className="text-xs text-muted-foreground">Lucro líquido</p>
                  <p className={`text-sm font-bold ${r.lucro >= 0 ? "text-sim" : "text-nao"}`}>
                    {r.lucro >= 0 ? "+" : ""}{formatCurrency(r.lucro)}
                  </p>
                </div>
              </div>

              {/* Mobile: só lucro */}
              <div className="sm:hidden shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{r.winRate.toFixed(0)}% acerto</p>
                <p className={`text-sm font-bold ${r.lucro >= 0 ? "text-sim" : "text-nao"}`}>
                  {r.lucro >= 0 ? "+" : ""}{formatCurrency(r.lucro)}
                </p>
              </div>

              <TrendingUp size={14} className="text-muted-foreground shrink-0 hidden sm:block" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
