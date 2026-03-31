export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingDown, Percent, DollarSign } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PageProps { params: Promise<{ username: string }> }

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, created_at")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: bets } = await supabase
    .from("bets")
    .select("amount, payout, status, side, created_at, topic:topics(id, title, category, status)")
    .eq("user_id", profile.id)
    .in("status", ["won", "lost", "matched", "pending", "refunded"])
    .order("created_at", { ascending: false })
    .limit(50);

  const resolved = bets?.filter((b) => b.status === "won" || b.status === "lost") ?? [];
  const betsWon = resolved.filter((b) => b.status === "won").length;
  const betsLost = resolved.filter((b) => b.status === "lost").length;
  const totalVolume = bets?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const winRate = resolved.length > 0 ? (betsWon / resolved.length) * 100 : 0;

  const initials = profile.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  const SIDE_STATUS: Record<string, { label: string; class: string }> = {
    won: { label: "Ganhou", class: "text-sim" },
    lost: { label: "Perdeu", class: "text-nao" },
    pending: { label: "Pendente", class: "text-yellow-400" },
    matched: { label: "Em jogo", class: "text-primary" },
    refunded: { label: "Reembolso", class: "text-muted-foreground" },
  };

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-6">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Trophy size={16} />, label: "Ganhas", value: betsWon, color: "text-sim" },
          { icon: <TrendingDown size={16} />, label: "Perdidas", value: betsLost, color: "text-nao" },
          { icon: <Percent size={16} />, label: "Taxa de acerto", value: `${winRate.toFixed(1)}%`, color: "text-primary" },
          { icon: <DollarSign size={16} />, label: "Volume total", value: formatCurrency(totalVolume), color: "text-white" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Histórico Público</h3>
        {!bets?.length ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nenhum investimento ainda</p>
        ) : (
          <div className="space-y-2">
            {bets.map((bet, i) => {
              const status = SIDE_STATUS[bet.status] ?? { label: bet.status, class: "text-muted-foreground" };
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
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
                    <p className="text-sm font-semibold text-white">{formatCurrency(bet.amount)}</p>
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
