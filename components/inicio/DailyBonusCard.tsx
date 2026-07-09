"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Gift, Check, Loader2 } from "lucide-react";
import { playConfirm, playStreak } from "@/lib/sound";

interface State {
  claimed_today: boolean;
  streak: number;
  claim_bonus: number;
}

export default function DailyBonusCard() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/bonus-diario")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setState(data))
      .catch(() => {});
  }, []);

  async function claim() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/bonus-diario", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Sequência ativa ganha o sting de combo; primeiro dia é confirmação simples
        if (data.streak > 1) playStreak();
        else playConfirm();
        setJustClaimed(data.bonus);
        setState({ claimed_today: true, streak: data.streak, claim_bonus: 0 });
        router.refresh();
      } else if (res.status === 409) {
        setState((s) => (s ? { ...s, claimed_today: true } : s));
      }
    } catch {}
    setLoading(false);
  }

  if (!state) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          {state.streak > 0 ? (
            <Flame size={20} className="text-primary" />
          ) : (
            <Gift size={20} className="text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {state.streak > 0
              ? `Sequência de ${state.streak} dia${state.streak > 1 ? "s" : ""}`
              : "Bônus diário"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {state.claimed_today
              ? justClaimed !== null && justClaimed > 0
                ? `Z$ ${justClaimed.toFixed(0)} creditados — volte amanhã pra manter a sequência!`
                : "Resgatado hoje — volte amanhã pra manter a sequência!"
              : `Resgate Z$ ${state.claim_bonus.toFixed(0)} de hoje — dias seguidos valem mais`}
          </p>
        </div>
      </div>

      {state.claimed_today ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary">
          <Check size={14} /> Resgatado
        </span>
      ) : (
        <button
          onClick={claim}
          disabled={loading}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            `Resgatar Z$ ${state.claim_bonus.toFixed(0)}`
          )}
        </button>
      )}
    </div>
  );
}
