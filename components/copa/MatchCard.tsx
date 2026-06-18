"use client";

import { Lock } from "lucide-react";
import type { CopaMatch, CopaPrediction, CopaStage } from "@/lib/copa/types";
import { isKnockout } from "@/lib/copa/types";
import { pointsFor, scorePrediction } from "@/lib/copa/scoring";
import PredictionForm from "./PredictionForm";
import RevealedPredictions from "./RevealedPredictions";

interface Props {
  match: CopaMatch;
  prediction: CopaPrediction | null;
  isParticipant: boolean;
}

const STAGE_LABEL: Record<CopaStage, string> = {
  group: "Grupos",
  r32: "32 avos",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semi",
  third: "3º lugar",
  final: "Final",
};

export default function MatchCard({ match: m, prediction, isParticipant }: Props) {
  const ko = isKnockout(m.stage);
  const kickedOff = new Date(m.kickoff_at).getTime() <= Date.now();
  const teamsSet = !!m.home_team && !!m.away_team;
  const canPredict =
    isParticipant && teamsSet && !kickedOff && (m.status === "scheduled" || m.status === "postponed");

  const time = new Date(m.kickoff_at).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

  const reasons = scorePrediction(m, prediction);
  const earned = reasons.reduce((sum, r) => sum + pointsFor(r), 0);

  const myPickLabel = (() => {
    if (!prediction) return null;
    if (ko) {
      if (!prediction.qualifier_pick) return null;
      return prediction.qualifier_pick === "home" ? m.home_team : m.away_team;
    }
    if (prediction.outcome_pick === "home") return m.home_team;
    if (prediction.outcome_pick === "away") return m.away_team;
    return prediction.outcome_pick === "draw" ? "Empate" : null;
  })();

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted">
          {STAGE_LABEL[m.stage]}
          {m.group_name ? ` ${m.group_name}` : ""}
        </span>
        <span>{time}</span>
        {m.status === "postponed" && <span className="text-green-400">Adiada</span>}
        {m.status === "under_review" && <span className="text-orange-400">Aguardando resultado oficial</span>}
        {m.status === "void" && <span className="text-nao">Anulada — não pontua</span>}
        <span className="ml-auto font-mono">#{m.match_number}</span>
      </div>

      {/* Times + placar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white flex-1">
          {m.home_team ?? m.home_placeholder ?? "A definir"}{" "}
          <span className="text-muted-foreground font-normal">vs</span>{" "}
          {m.away_team ?? m.away_placeholder ?? "A definir"}
        </p>
        {m.status === "finished" && m.home_goals != null && (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-white font-mono">
              {m.home_goals}–{m.away_goals}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {m.went_to_pens ? "nos pênaltis" : m.went_to_et ? "na prorrogação" : "tempo normal"}
              {ko && m.advanced_side && (
                <span className="text-green-400">
                  {" "}· {m.advanced_side === "home" ? m.home_team : m.away_team} avançou
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Palpite */}
      {canPredict ? (
        <PredictionForm match={m} prediction={prediction} />
      ) : (
        <div className="space-y-2">
          {prediction ? (
            <div className="flex items-center gap-2 text-xs">
              <Lock size={11} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                Seu palpite: <span className="text-white">{myPickLabel ?? "—"}</span>
                {prediction.pred_home_goals != null && prediction.pred_away_goals != null && (
                  <span className="font-mono"> ({prediction.pred_home_goals}–{prediction.pred_away_goals})</span>
                )}
              </span>
              {m.status === "finished" && (
                <span className={`ml-auto font-bold ${earned > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                  {earned > 0 ? `+${earned} pts` : "0 pts"}
                </span>
              )}
            </div>
          ) : isParticipant ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock size={11} />
              {!teamsSet
                ? "Times ainda não definidos"
                : kickedOff || m.status !== "scheduled"
                ? "Previsões encerradas — sem palpite nesta partida"
                : "Previsões encerradas"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Inscreva-se na Zafe Copa para enviar palpites.</p>
          )}
          {kickedOff && m.status !== "void" && <RevealedPredictions match={m} />}
        </div>
      )}
    </div>
  );
}
