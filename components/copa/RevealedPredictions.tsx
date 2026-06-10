"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import type { CopaMatch, CopaPrediction } from "@/lib/copa/types";
import { isKnockout } from "@/lib/copa/types";

interface Revealed extends CopaPrediction {
  profiles: { username: string; avatar_url: string | null } | null;
}

// Palpites dos outros participantes — liberados pelo servidor (e pela RLS)
// só depois do kickoff. Carrega sob demanda.
export default function RevealedPredictions({ match }: { match: CopaMatch }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preds, setPreds] = useState<Revealed[] | null>(null);
  const ko = isKnockout(match.stage);

  async function load() {
    if (preds) {
      setOpen(!open);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/copa/partidas/${match.id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPreds(data.predictions ?? []);
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function pickLabel(p: Revealed) {
    if (ko) {
      if (!p.qualifier_pick) return "—";
      return p.qualifier_pick === "home" ? match.home_team : match.away_team;
    }
    if (p.outcome_pick === "home") return match.home_team;
    if (p.outcome_pick === "away") return match.away_team;
    return p.outcome_pick === "draw" ? "Empate" : "—";
  }

  return (
    <div className="space-y-2">
      <button
        onClick={load}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
        {open ? "Ocultar palpites" : "Ver palpites dos participantes"}
      </button>
      {open && preds && (
        <div className="space-y-1">
          {preds.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum palpite nesta partida.</p>
          )}
          {preds.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs bg-input border border-border rounded-lg px-2 py-1.5">
              <span className="text-white font-medium flex-1 truncate">
                {p.profiles?.username ?? "participante"}
              </span>
              <span className="text-muted-foreground">{pickLabel(p)}</span>
              {p.pred_home_goals != null && p.pred_away_goals != null && (
                <span className="font-mono text-muted-foreground">
                  {p.pred_home_goals}–{p.pred_away_goals}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
