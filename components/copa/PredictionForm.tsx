"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CopaMatch, CopaPrediction } from "@/lib/copa/types";
import { isKnockout } from "@/lib/copa/types";

interface Props {
  match: CopaMatch;
  prediction: CopaPrediction | null;
}

// Form de palpite. O lock real é no servidor (kickoff re-lido no POST);
// aqui só desabilitamos a UI quando o horário passa.
export default function PredictionForm({ match, prediction }: Props) {
  const router = useRouter();
  const ko = isKnockout(match.stage);

  const [outcome, setOutcome] = useState<string>(prediction?.outcome_pick ?? "");
  const [qualifier, setQualifier] = useState<string>(prediction?.qualifier_pick ?? "");
  const [homeGoals, setHomeGoals] = useState(
    prediction?.pred_home_goals != null ? String(prediction.pred_home_goals) : ""
  );
  const [awayGoals, setAwayGoals] = useState(
    prediction?.pred_away_goals != null ? String(prediction.pred_away_goals) : ""
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoreIncomplete = (homeGoals === "") !== (awayGoals === "");
  const pickMissing = ko ? !qualifier : !outcome;
  const locked = new Date(match.kickoff_at).getTime() <= Date.now();

  async function submit() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/copa/palpitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: match.id,
          outcome_pick: ko ? undefined : outcome,
          qualifier_pick: ko ? qualifier : undefined,
          pred_home_goals: homeGoals === "" ? null : Number(homeGoals),
          pred_away_goals: awayGoals === "" ? null : Number(awayGoals),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar previsão");
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

  const pickBtn = (active: boolean) =>
    `flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition-colors ${
      active
        ? "bg-amber-400/20 border-amber-400 text-amber-400"
        : "bg-input border-border text-muted-foreground hover:text-white"
    }`;

  return (
    <div className="space-y-3">
      {ko ? (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Quem se classifica? (vale pênaltis)</p>
          <div className="flex gap-2">
            <button onClick={() => setQualifier("home")} className={pickBtn(qualifier === "home")}>
              {match.home_team}
            </button>
            <button onClick={() => setQualifier("away")} className={pickBtn(qualifier === "away")}>
              {match.away_team}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Resultado (90 min)</p>
          <div className="flex gap-2">
            <button onClick={() => setOutcome("home")} className={pickBtn(outcome === "home")}>
              {match.home_team}
            </button>
            <button onClick={() => setOutcome("draw")} className={pickBtn(outcome === "draw")}>
              Empate
            </button>
            <button onClick={() => setOutcome("away")} className={pickBtn(outcome === "away")}>
              {match.away_team}
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">
          Placar exato <span className="text-amber-400">(+10, opcional)</span>
          {ko && <span className="block text-[10px]">ao fim da prorrogação, sem pênaltis</span>}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} max={20} inputMode="numeric"
            value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)}
            className="w-16 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-400/50"
          />
          <span className="text-muted-foreground text-sm">×</span>
          <input
            type="number" min={0} max={20} inputMode="numeric"
            value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)}
            className="w-16 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-400/50"
          />
        </div>
        {scoreIncomplete && (
          <p className="text-[10px] text-amber-400 mt-1">Preencha os dois lados do placar (ou nenhum)</p>
        )}
      </div>

      {error && <p className="text-xs text-nao">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={loading || locked || pickMissing || scoreIncomplete}
          className="px-4 py-2 bg-amber-400 text-black font-bold text-xs rounded-lg hover:bg-amber-400/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin mx-auto" />
          ) : prediction ? (
            "Atualizar palpite"
          ) : (
            "Salvar palpite"
          )}
        </button>
        {saved && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Palpite salvo
          </span>
        )}
        {!locked && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            fecha {formatDistanceToNow(new Date(match.kickoff_at), { addSuffix: true, locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}
