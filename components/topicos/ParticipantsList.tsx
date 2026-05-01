import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Bet {
  id: string;
  side: "sim" | "nao";
  amount: number;
  status: string;
  locked_odds?: string | null;
  order_id?: string | null;
  created_at: string;
  profiles?: { username?: string; full_name?: string } | { username?: string; full_name?: string }[] | null;
}

interface Props {
  bets: Bet[];
  totalSim: number;
  totalNao: number;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pendente", cls: "text-yellow-400" },
  matched:  { label: "Ativo",    cls: "text-primary" },
  partial:  { label: "Ativo",    cls: "text-primary" },
  won:      { label: "Ganhou",   cls: "text-sim" },
  lost:     { label: "Perdeu",   cls: "text-nao" },
  refunded: { label: "Reemb.",   cls: "text-muted-foreground" },
};

export default function ParticipantsList({ bets, totalSim, totalNao }: Props) {
  if (!bets || bets.length === 0) return null;

  const simBets  = bets.filter((b) => b.side === "sim");
  const naoBets  = bets.filter((b) => b.side === "nao");
  const totalParticipants = new Set(bets.map((b) => {
    const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return p?.username;
  })).size;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Users size={14} className="text-muted-foreground" />
        <p className="text-sm font-semibold text-white">
          Participantes
        </p>
        <span className="ml-auto text-xs text-muted-foreground">
          {bets.length} palpite{bets.length !== 1 ? "s" : ""} · {totalParticipants} usuário{totalParticipants !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Colunas SIM / NÃO lado a lado */}
      <div className="grid grid-cols-2 divide-x divide-border/50">
        {/* Coluna SIM */}
        <div>
          <div className="px-3 py-2 border-b border-border/30 bg-sim/5">
            <p className="text-[11px] font-bold text-sim">
              SIM — {formatCurrency(totalSim)}
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {simBets.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum palpite SIM</p>
            ) : (
              simBets.map((bet) => (
                <BetRow key={bet.id} bet={bet} totalSide={totalSim} />
              ))
            )}
          </div>
        </div>

        {/* Coluna NÃO */}
        <div>
          <div className="px-3 py-2 border-b border-border/30 bg-nao/5">
            <p className="text-[11px] font-bold text-nao">
              NÃO — {formatCurrency(totalNao)}
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {naoBets.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum palpite NÃO</p>
            ) : (
              naoBets.map((bet) => (
                <BetRow key={bet.id} bet={bet} totalSide={totalNao} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BetRow({ bet, totalSide }: { bet: Bet; totalSide: number }) {
  const rawProfile = bet.profiles;
  const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const username = profile?.username ?? profile?.full_name ?? null;
  const pct = totalSide > 0 ? ((Number(bet.amount) / totalSide) * 100).toFixed(1) : "0.0";
  const lockedOdds = parseFloat(bet.locked_odds ?? "0");
  const entryProb = bet.order_id && lockedOdds > 0
    ? `${Math.round((1 / lockedOdds) * 100)}%`
    : null;
  const statusInfo = STATUS_LABEL[bet.status] ?? { label: bet.status, cls: "text-muted-foreground" };

  return (
    <div className="px-3 py-2 space-y-0.5">
      <div className="flex items-center justify-between gap-1">
        {username ? (
          <Link
            href={`/u/${username}`}
            className="text-xs text-white hover:text-primary transition-colors font-medium truncate"
          >
            @{username}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Anônimo</span>
        )}
        <span className="text-xs font-semibold text-white shrink-0">
          {formatCurrency(Number(bet.amount))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(bet.created_at), "dd/MM HH:mm", { locale: ptBR })}
          {entryProb && <span className="ml-1 text-yellow-400">@ {entryProb}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{pct}% do lado</span>
          <span className={`text-[10px] font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>
      </div>
    </div>
  );
}
