export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingDown, Percent, TrendingUp, Flame, Star } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PageProps { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("username", username)
    .single();
  if (!profile) return { title: "Perfil não encontrado" };
  const name = profile.full_name ?? profile.username;
  return {
    title: name,
    description: `Veja o histórico e desempenho de ${name} nos mercados de previsão do Zafe.`,
    openGraph: {
      title: `${name} — Zafe`,
      description: `Veja o histórico e desempenho de ${name} nos mercados de previsão do Zafe.`,
      type: "profile",
    },
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  politica: "Política", economia: "Economia", esportes: "Esportes",
  tecnologia: "Tecnologia", entretenimento: "Entretenimento", internacional: "Internacional", outro: "Outro",
};

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  // Use admin client to bypass RLS — bets/profiles are private by default
  const adminSupabase = createAdminClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id, full_name, username, created_at")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: bets } = await adminSupabase
    .from("bets")
    .select("amount, potential_payout, status, side, created_at, topic:topics(id, title, category, status)")
    .eq("user_id", profile.id)
    .in("status", ["won", "lost", "matched", "pending", "refunded", "partial"])
    .order("created_at", { ascending: false })
    .limit(100);

  const all      = bets ?? [];
  const resolved = all.filter((b) => b.status === "won" || b.status === "lost");
  const betsWon  = resolved.filter((b) => b.status === "won").length;
  const betsLost = resolved.filter((b) => b.status === "lost").length;
  const winRate  = resolved.length > 0 ? (betsWon / resolved.length) * 100 : 0;

  // P&L total
  const totalPnl = resolved.reduce((sum, b) => {
    if (b.status === "won") return sum + ((b.potential_payout ?? 0) - b.amount);
    return sum - b.amount;
  }, 0);

  // Sequência de acertos atual (mais recente para mais antigo)
  const sortedResolved = [...resolved].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  let streak = 0;
  for (const b of sortedResolved) {
    if (b.status === "won") streak++;
    else break;
  }

  // Melhor categoria (mín. 2 apostas resolvidas)
  const catStats: Record<string, { won: number; total: number }> = {};
  for (const b of resolved) {
    const cat = (b.topic as any)?.category ?? "outro";
    if (!catStats[cat]) catStats[cat] = { won: 0, total: 0 };
    catStats[cat].total++;
    if (b.status === "won") catStats[cat].won++;
  }
  let bestCat: string | null = null;
  let bestRate = 0;
  for (const [cat, s] of Object.entries(catStats)) {
    if (s.total >= 2 && s.won / s.total > bestRate) {
      bestRate = s.won / s.total;
      bestCat  = cat;
    }
  }

  const initials = profile.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  const SIDE_STATUS: Record<string, { label: string; class: string }> = {
    won:      { label: "Ganhou",    class: "text-sim" },
    lost:     { label: "Perdeu",    class: "text-nao" },
    pending:  { label: "Pendente",  class: "text-yellow-400" },
    matched:  { label: "Em jogo",   class: "text-primary" },
    partial:  { label: "Em jogo",   class: "text-primary" },
    refunded: { label: "Reembolso", class: "text-muted-foreground" },
  };

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold text-white">{profile.full_name}</h1>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Membro desde {format(new Date(profile.created_at), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: <Trophy size={16} />,      label: "Ganhas",        value: betsWon,                     color: "text-sim" },
          { icon: <TrendingDown size={16} />, label: "Perdidas",      value: betsLost,                    color: "text-nao" },
          { icon: <Percent size={16} />,      label: "Taxa de acerto",value: `${winRate.toFixed(1)}%`,    color: "text-primary" },
          {
            icon: totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
            label: "Lucro/Prejuízo",
            value: `${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`,
            color: totalPnl >= 0 ? "text-sim" : "text-nao",
          },
          {
            icon: <Flame size={16} />,
            label: "Sequência atual",
            value: streak > 0 ? `${streak}🔥` : "—",
            color: streak >= 3 ? "text-orange-400" : "text-white",
          },
          {
            icon: <Star size={16} />,
            label: "Melhor categoria",
            value: bestCat ? `${CATEGORY_LABELS[bestCat] ?? bestCat} (${(bestRate * 100).toFixed(0)}%)` : "—",
            color: "text-yellow-400",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
            <p className={`text-base font-bold ${stat.color} leading-tight`}>{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Histórico público */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Histórico Público</h3>
        {!all.length ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nenhum investimento ainda</p>
        ) : (
          <div className="space-y-0">
            {all.slice(0, 30).map((bet, i) => {
              const status = SIDE_STATUS[bet.status] ?? { label: bet.status, class: "text-muted-foreground" };
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <Link href={`/topicos/${(bet.topic as any)?.id}`} className="hover:text-primary transition-colors">
                      <p className="text-sm text-white truncate">{(bet.topic as any)?.title}</p>
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(bet.topic as any)?.category && <CategoryBadge category={(bet.topic as any).category} />}
                      <span className={`text-xs font-semibold ${bet.side === "sim" ? "text-sim" : "text-nao"}`}>
                        {bet.side.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(bet.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {bet.status === "won" ? (
                      <p className="text-sm font-semibold text-sim">+{formatCurrency((bet.potential_payout ?? 0) - bet.amount)}</p>
                    ) : bet.status === "lost" ? (
                      <p className="text-sm font-semibold text-nao">-{formatCurrency(bet.amount)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-white">{formatCurrency(bet.amount)}</p>
                    )}
                    <p className={`text-xs ${status.class}`}>{status.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
