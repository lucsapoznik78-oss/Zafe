import { Trophy, Users, Calendar } from "lucide-react";
import type { CopaCompetition } from "@/lib/copa/types";

interface Props {
  competition: CopaCompetition;
  participants: number;
}

// Banner do pote: Z$ buy_in × N participantes; o 1º do ranking leva tudo.
export default function PotBanner({ competition, participants }: Props) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
            <Trophy size={12} className="text-primary" /> Premiação acumulada
          </p>
          <p className="text-3xl font-bold text-primary">
            Z$ {Number(competition.pot_total).toLocaleString("pt-BR")}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Z$ {Number(competition.buy_in).toLocaleString("pt-BR")} por inscrição · o 1º colocado do ranking final leva tudo
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-muted-foreground flex items-center justify-end gap-1.5">
            <Users size={12} /> {participants} participante{participants === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted-foreground flex items-center justify-end gap-1.5">
            <Calendar size={12} /> {fmtDate(competition.starts_at)} – {fmtDate(competition.ends_at)}
          </p>
          {competition.status === "paid" && (
            <p className="text-xs text-primary font-semibold">Premiação paga ao campeão</p>
          )}
        </div>
      </div>
    </div>
  );
}
