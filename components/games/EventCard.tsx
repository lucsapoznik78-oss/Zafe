"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, Coins, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GamesEvent, GamesPrediction, GamesSide } from "@/lib/games/types";
import { GAME_LABELS } from "@/lib/games/types";

interface Props {
  event: GamesEvent;
  prediction: GamesPrediction | null;
  isAuthed: boolean;
}

// Card de um evento de e-sports. Lock real é no servidor (closes_at re-lido
// no POST); aqui só desabilitamos a UI quando o horário passa. No modo pote,
// o palpite é definitivo (o stake entra no pote) — sem troca.
export default function EventCard({ event, prediction, isAuthed }: Props) {
  const router = useRouter();
  const [pick, setPick] = useState<GamesSide | null>(prediction?.pick ?? null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPot = event.mode === "pot";
  const locked = event.status !== "scheduled" || new Date(event.closes_at).getTime() <= Date.now();
  const potLockedIn = isPot && !!prediction; // pote já pago, não troca
  const finished = event.status === "finished";

  async function submit(chosen: GamesSide) {
    if (potLockedIn) return;
    setPick(chosen);
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/games/palpitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: event.id, pick: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar palpite");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Falha de rede — tente novamente");
    } finally {
      setLoading(false);
    }
  }

  const sideBtn = (side: GamesSide, label: string) => {
    const active = pick === side;
    const isWinner = finished && event.winner === side;
    const isLoser = finished && event.winner !== null && event.winner !== side;
    return (
      <button
        key={side}
        disabled={!isAuthed || locked || loading || potLockedIn}
        onClick={() => submit(side)}
        className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold border transition-colors disabled:cursor-not-allowed ${
          isWinner
            ? "bg-violet-500/30 border-violet-400 text-violet-200"
            : isLoser
              ? "bg-input border-border text-muted-foreground opacity-60"
              : active
                ? "bg-violet-500/20 border-violet-400 text-violet-300"
                : "bg-input border-border text-white hover:border-violet-400/50 disabled:opacity-50"
        }`}
      >
        {label}
        {isWinner && <Trophy size={12} className="inline ml-1.5" />}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-[10px] font-bold uppercase tracking-wide">
          {GAME_LABELS[event.game]}
        </span>
        {event.tournament && (
          <span className="text-[11px] text-muted-foreground truncate">{event.tournament}</span>
        )}
        {isPot && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 ml-auto">
            <Coins size={12} /> Pote Z$ {Number(event.pot_total).toFixed(0)}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {sideBtn("a", event.side_a)}
        <div className="self-center text-xs text-muted-foreground font-bold">×</div>
        {sideBtn("b", event.side_b)}
      </div>

      {isPot && !prediction && !locked && (
        <p className="text-[11px] text-violet-300/80">
          Entrada: Z$ {Number(event.buy_in).toFixed(0)} — vai pro pote. Palpite definitivo.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {finished ? (
          <span className="inline-flex items-center gap-1 text-violet-300">
            <Trophy size={12} /> Encerrado
            {prediction && (
              <span className="ml-1">
                — {prediction.settle_status === "won" ? "você acertou" : prediction.pick === event.winner ? "você acertou" : "não foi dessa vez"}
                {prediction.payout != null && Number(prediction.payout) > 0 && ` (+Z$ ${Number(prediction.payout).toFixed(0)})`}
              </span>
            )}
          </span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1">
            <Lock size={12} /> Palpites encerrados
          </span>
        ) : (
          <>
            {saved && (
              <span className="inline-flex items-center gap-1 text-violet-300">
                <CheckCircle2 size={12} /> Palpite salvo
              </span>
            )}
            {loading && <Loader2 size={12} className="animate-spin" />}
            <span className="ml-auto">
              fecha {formatDistanceToNow(new Date(event.closes_at), { addSuffix: true, locale: ptBR })}
            </span>
          </>
        )}
      </div>

      {!isAuthed && !locked && (
        <p className="text-[11px] text-muted-foreground">Entre para palpitar.</p>
      )}
    </div>
  );
}
