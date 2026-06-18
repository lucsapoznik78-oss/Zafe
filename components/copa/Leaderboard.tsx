import { Trophy } from "lucide-react";
import type { CopaLeaderboardRow } from "@/lib/copa/types";

interface Props {
  rows: CopaLeaderboardRow[];
  meUserId?: string | null;
}

// Ranking da Zafe Copa. Desempate: pontos → placares exatos →
// acertos de vencedor/classificado → ordem de inscrição (join_seq).
export default function Leaderboard({ rows, meUserId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        Nenhum participante pontuou ainda.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
        <span>#</span>
        <span>Participante</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Exatos</span>
        <span className="text-right">Acertos</span>
      </div>
      {rows.map((r) => {
        const isMe = meUserId != null && r.user_id === meUserId;
        return (
          <div
            key={r.participant_id}
            className={`grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem] gap-2 px-4 py-2.5 items-center border-b border-border last:border-b-0 text-sm ${
              isMe ? "bg-sky-400/10" : ""
            }`}
          >
            <span className="font-mono text-muted-foreground flex items-center gap-1">
              {r.posicao}
              {r.posicao === 1 && <Trophy size={11} className="text-sky-400" />}
            </span>
            <span className={`truncate ${isMe ? "text-sky-400 font-semibold" : "text-white"}`}>
              {r.username}
              {isMe && <span className="text-[10px] ml-1.5 text-sky-400/70">(você)</span>}
            </span>
            <span className="text-right font-bold text-white">{r.points}</span>
            <span className="text-right text-muted-foreground">{r.exact_count}</span>
            <span className="text-right text-muted-foreground">{r.outcome_count}</span>
          </div>
        );
      })}
    </div>
  );
}
