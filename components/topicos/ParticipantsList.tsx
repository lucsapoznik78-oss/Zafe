import Link from "next/link";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Bet {
  id: string;
  side: "sim" | "nao";
  amount: number;
  status: string;
  locked_odds?: string | null;
  created_at: string;
  profiles?: { username?: string; full_name?: string } | { username?: string; full_name?: string }[] | null;
}

interface Props {
  bets: Bet[];
  totalSim: number;
  totalNao: number;
}

const STATUS_DOT: Record<string, string> = {
  won:      "bg-sim",
  lost:     "bg-nao",
  pending:  "bg-yellow-400",
  matched:  "bg-primary",
  partial:  "bg-primary",
  refunded: "bg-zinc-500",
  exited:   "bg-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  won:      "ganhou",
  lost:     "perdeu",
  matched:  "ativo",
  partial:  "ativo",
  pending:  "pendente",
  refunded: "reembolso",
  exited:   "saiu",
};

function getInitials(username?: string | null, fullName?: string | null) {
  const name = username ?? fullName ?? "?";
  return name.slice(0, 2).toUpperCase();
}

function formatDay(dateStr: string) {
  return format(new Date(dateStr), "d 'de' MMM", { locale: ptBR });
}

function formatZ(v: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
}

export default function ParticipantsList({ bets, totalSim, totalNao }: Props) {
  if (!bets || bets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <Users size={20} className="mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum participante ainda</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Seja o primeiro a palpitar</p>
      </div>
    );
  }

  const totalVolume = totalSim + totalNao;
  const totalParticipants = new Set(bets.map((b) => {
    const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    return p?.username ?? b.id;
  })).size;

  // Ordena por valor desc
  const sorted = [...bets].sort((a, b) => Number(b.amount) - Number(a.amount));

  const simCount = bets.filter((b) => b.side === "sim").length;
  const naoCount = bets.filter((b) => b.side === "nao").length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2 flex-wrap">
        <Users size={14} className="text-muted-foreground" />
        <p className="text-sm font-semibold text-white">Participantes</p>
        <span className="text-xs text-muted-foreground">
          {totalParticipants} usuário{totalParticipants !== 1 ? "s" : ""} · {bets.length} palpite{bets.length !== 1 ? "s" : ""}
        </span>

        {/* Pill SIM / NÃO */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sim/10 text-sim text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-sim" />
            SIM {simCount}
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-nao/10 text-nao text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-nao" />
            NÃO {naoCount}
          </span>
        </div>
      </div>

      {/* Pool split bar */}
      {totalVolume > 0 && (
        <div className="flex h-1">
          <div
            className="bg-sim transition-all duration-500"
            style={{ width: `${(totalSim / totalVolume) * 100}%` }}
          />
          <div
            className="bg-nao transition-all duration-500 flex-1"
          />
        </div>
      )}

      {/* Lista */}
      <div className="divide-y divide-border/30">
        {sorted.map((bet, idx) => {
          const rawProfile = bet.profiles;
          const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
          const username = profile?.username ?? null;
          const fullName = profile?.full_name ?? null;
          const displayName = username ?? fullName ?? "anônimo";
          const initials = getInitials(username, fullName);

          const pctTotal = totalVolume > 0 ? (Number(bet.amount) / totalVolume) * 100 : 0;
          const pctSide  = bet.side === "sim"
            ? (totalSim > 0 ? (Number(bet.amount) / totalSim) * 100 : 0)
            : (totalNao > 0 ? (Number(bet.amount) / totalNao) * 100 : 0);

          const dotCls   = STATUS_DOT[bet.status]   ?? "bg-zinc-500";
          const statusTx = STATUS_LABEL[bet.status] ?? bet.status;
          const isSim    = bet.side === "sim";

          return (
            <div key={bet.id} className="px-4 py-3 flex items-center gap-3 group hover:bg-white/[0.02] transition-colors">

              {/* Posição + Avatar */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-600 w-4 text-center font-mono">
                  {idx + 1}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isSim ? "bg-sim/20 text-sim" : "bg-nao/20 text-nao"
                }`}>
                  {initials}
                </div>
              </div>

              {/* Nome + data */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {username ? (
                    <Link
                      href={`/u/${username}`}
                      className="text-sm font-semibold text-white hover:text-primary transition-colors"
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{displayName}</span>
                  )}

                  {/* Badge SIM/NÃO */}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                    isSim ? "bg-sim/15 text-sim" : "bg-nao/15 text-nao"
                  }`}>
                    {isSim ? "SIM" : "NÃO"}
                  </span>

                  {/* Status dot */}
                  <span className={`w-1.5 h-1.5 rounded-full ${dotCls} shrink-0`} title={statusTx} />
                </div>

                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {/* Barra de participação do lado */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isSim ? "bg-sim" : "bg-nao"}`}
                        style={{ width: `${Math.min(pctSide, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {pctSide.toFixed(1)}% do {isSim ? "SIM" : "NÃO"}
                    </span>
                  </div>

                  <span className="text-[10px] text-zinc-600">
                    {formatDay(bet.created_at)}
                  </span>
                </div>
              </div>

              {/* Valores */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-white">
                  Z$ {formatZ(Number(bet.amount))}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {pctTotal.toFixed(1)}% do pool
                </p>
              </div>

            </div>
          );
        })}
      </div>

      {/* Footer: resumo de volumes */}
      {totalVolume > 0 && (
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-sim font-semibold">
              SIM Z$ {formatZ(totalSim)}
            </span>
            <span className="text-[11px] text-nao font-semibold">
              NÃO Z$ {formatZ(totalNao)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Total Z$ {formatZ(totalVolume)}
          </span>
        </div>
      )}

    </div>
  );
}
