export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ranking",
  description: "Veja os melhores previsores do Zafe. Ranking de acertos, lucros e performance na liga de previsões.",
  alternates: { canonical: "/ranking" },
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
import { Trophy, TrendingUp, Medal, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import RankingFilters from "@/components/ranking/RankingFilters";

const MIN_BETS = 1;
const PER_PAGE = 50;

interface PageProps {
  searchParams: Promise<{ periodo?: string; page?: string }>;
}

export default async function RankingPage({ searchParams }: PageProps) {
  const { periodo = "todos", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);
  const supabase = createAdminClient();

  const desde: string | null =
    periodo === "semana"
      ? new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
      : periodo === "mes"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  let query = supabase
    .from("bets")
    .select("user_id, amount, potential_payout, status")
    .in("status", ["won", "lost", "matched", "pending"]);

  if (desde) {
    query = query.gte("created_at", desde);
  }

  const { data: bets } = await query;

  const statsMap = new Map<string, {
    wins: number; losses: number; pendentes: number;
    lucro: number; volume: number;
  }>();

  for (const bet of bets ?? []) {
    const s = statsMap.get(bet.user_id) ?? { wins: 0, losses: 0, pendentes: 0, lucro: 0, volume: 0 };
    s.volume += bet.amount;
    if (bet.status === "won") {
      s.wins++;
      s.lucro += (bet.potential_payout ?? 0) - bet.amount;
    } else if (bet.status === "lost") {
      s.losses++;
      s.lucro -= bet.amount;
    } else {
      s.pendentes++;
    }
    statsMap.set(bet.user_id, s);
  }

  const allUserIds = Array.from(statsMap.entries())
    .filter(([, s]) => s.wins + s.losses + s.pendentes >= MIN_BETS)
    .sort((a, b) => b[1].lucro - a[1].lucro || b[1].volume - a[1].volume)
    .map(([id]) => id);

  const totalPages = Math.max(1, Math.ceil(allUserIds.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PER_PAGE;
  const userIds = allUserIds.slice(offset, offset + PER_PAGE);

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
        pos: offset + index + 1,
        id,
        username: p?.username ?? "—",
        full_name: p?.full_name ?? "—",
        wins: s.wins,
        losses: s.losses,
        total,
        pendentes: s.pendentes,
        winRate: total > 0 ? (s.wins / total) * 100 : 0,
        lucro: s.lucro,
        volume: s.volume,
      };
    });

  const buildPageHref = (p: number) =>
    `/ranking?${new URLSearchParams({ periodo, page: String(p) })}`;

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={22} className="text-primary" />
          Ranking de Preditores
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ordenado por lucro líquido em Z$
        </p>
      </div>

      <RankingFilters periodo={periodo} />

      {ranking.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
          <Trophy size={32} className="text-muted-foreground mx-auto" />
          <p className="text-white font-semibold">Nenhum preditor ainda</p>
          <p className="text-sm text-muted-foreground">
            Faça pelo menos um palpite para entrar no ranking.
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

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">@{r.username}</p>
              </div>

              <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">Acertos</p>
                  {r.total > 0 ? (
                    <p className="text-sm font-semibold text-white">
                      {r.winRate.toFixed(0)}%
                      <span className="text-xs text-muted-foreground ml-1">({r.wins}/{r.total})</span>
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground">
                      {r.pendentes} em aberto
                    </p>
                  )}
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

              <div className="sm:hidden shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {r.total > 0 ? `${r.winRate.toFixed(0)}% acerto` : `${r.pendentes} em aberto`}
                </p>
                <p className={`text-sm font-bold ${r.lucro >= 0 ? "text-sim" : "text-nao"}`}>
                  {r.lucro >= 0 ? "+" : ""}{formatCurrency(r.lucro)}
                </p>
              </div>

              <TrendingUp size={14} className="text-muted-foreground shrink-0 hidden sm:block" />
            </Link>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              {currentPage > 1 && (
                <Link
                  href={buildPageHref(currentPage - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-white hover:border-primary/40 transition-colors"
                >
                  <ChevronLeft size={14} />
                  Anterior
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link
                  href={buildPageHref(currentPage + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-white hover:border-primary/40 transition-colors"
                >
                  Próxima
                  <ChevronRight size={14} />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
