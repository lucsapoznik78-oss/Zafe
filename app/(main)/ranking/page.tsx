export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ranking",
  description: "Veja os melhores previsores do Zafe. Ranking geral por saldo em Z$.",
  alternates: { canonical: "/ranking" },
  openGraph: {
    title: "Ranking — Zafe",
    description: "Veja os melhores previsores do Zafe. Ranking geral por saldo em Z$.",
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

const PER_PAGE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function RankingPage({ searchParams }: PageProps) {
  const { page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);
  const supabase = createAdminClient();

  const [{ data: wallets }, { data: bets }] = await Promise.all([
    supabase
      .from("wallets")
      .select("user_id, balance")
      .order("balance", { ascending: false }),
    supabase
      .from("bets")
      .select("user_id, status")
      .in("status", ["won", "lost"]),
  ]);

  // Stats de acerto (secundário — não afeta a ordenação)
  const statsMap = new Map<string, { wins: number; losses: number }>();
  for (const bet of bets ?? []) {
    const s = statsMap.get(bet.user_id) ?? { wins: 0, losses: 0 };
    if (bet.status === "won") s.wins++;
    else s.losses++;
    statsMap.set(bet.user_id, s);
  }

  const allWallets = wallets ?? [];
  const totalPages = Math.max(1, Math.ceil(allWallets.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PER_PAGE;
  const pageWallets = allWallets.slice(offset, offset + PER_PAGE);
  const userIds = pageWallets.map((w) => w.user_id);

  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const ranking = pageWallets.map((w, index) => {
    const p = profileMap.get(w.user_id);
    const s = statsMap.get(w.user_id) ?? { wins: 0, losses: 0 };
    const total = s.wins + s.losses;
    return {
      pos: offset + index + 1,
      id: w.user_id,
      username: p?.username ?? "—",
      full_name: p?.full_name ?? "—",
      saldo: Number(w.balance ?? 0),
      wins: s.wins,
      total,
      winRate: total > 0 ? (s.wins / total) * 100 : 0,
    };
  });

  const buildPageHref = (p: number) => `/ranking?page=${p}`;

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={22} className="text-primary" />
          Ranking Geral
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ordenado por saldo em Z$
        </p>
      </div>

      {ranking.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
          <Trophy size={32} className="text-muted-foreground mx-auto" />
          <p className="text-white font-semibold">Nenhum previsor ainda</p>
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
                    <p className="text-sm font-semibold text-muted-foreground">—</p>
                  )}
                </div>
                <div className="w-28">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(r.saldo)}</p>
                </div>
              </div>

              <div className="sm:hidden shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {r.total > 0 ? `${r.winRate.toFixed(0)}% acerto` : "—"}
                </p>
                <p className="text-sm font-bold text-primary">{formatCurrency(r.saldo)}</p>
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
