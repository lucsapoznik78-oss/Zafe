import {
  CopaMatch,
  CopaOutcome,
  CopaPrediction,
  CopaScoreEventInput,
  POINTS_EXACT,
  POINTS_OUTCOME,
  ScoreReason,
  isKnockout,
} from "./types";

// ============================================================
// Zafe Copa — engine de pontuação
//
// DETERMINÍSTICA e PURA (zero I/O): mesma entrada → mesma saída.
// O oráculo (Claude) só adjudica o RESULTADO da partida; os pontos
// são decididos exclusivamente aqui. A idempotência no banco é
// garantida por UNIQUE(match_id, participant_id, reason) +
// copa_rescore_match (delete + insert atômico).
//
// Regras:
//  * +10 (POINTS_OUTCOME): vencedor 1X2 certo (grupos) ou
//    classificado certo (mata-mata, inclui pênaltis)
//  * +10 (POINTS_EXACT): placar exato — grupos: 90 min;
//    mata-mata: placar ao fim da prorrogação quando houver,
//    SEM pênaltis
//  * Mata-mata DESACOPLADO: placar certo + classificado errado
//    = só +10 do placar
//  * Partida void/não finalizada ou sem palpite → zero eventos
// ============================================================

export function outcomeFromScore(homeGoals: number, awayGoals: number): CopaOutcome {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

/**
 * Pontua um palpite contra o resultado de uma partida finalizada.
 * Retorna os motivos de pontuação conquistados (cada um vale 10).
 */
export function scorePrediction(
  match: Pick<
    CopaMatch,
    "stage" | "status" | "home_goals" | "away_goals" | "advanced_side"
  >,
  pred: Pick<
    CopaPrediction,
    "outcome_pick" | "qualifier_pick" | "pred_home_goals" | "pred_away_goals"
  > | null
): ScoreReason[] {
  if (!pred) return [];
  if (match.status !== "finished") return [];
  if (match.home_goals == null || match.away_goals == null) return [];

  const reasons: ScoreReason[] = [];

  if (isKnockout(match.stage)) {
    // Classificado (inclui pênaltis) — independente do placar.
    if (match.advanced_side != null && pred.qualifier_pick === match.advanced_side) {
      reasons.push("outcome");
    }
  } else {
    // Grupos: 1X2 sobre o placar de 90 min.
    const actual = outcomeFromScore(match.home_goals, match.away_goals);
    if (pred.outcome_pick === actual) {
      reasons.push("outcome");
    }
  }

  // Placar exato (grupos: 90 min; mata-mata: fim da prorrogação, sem pênaltis).
  if (
    pred.pred_home_goals != null &&
    pred.pred_away_goals != null &&
    pred.pred_home_goals === match.home_goals &&
    pred.pred_away_goals === match.away_goals
  ) {
    reasons.push("exact_score");
  }

  return reasons;
}

export function pointsFor(reason: ScoreReason): number {
  return reason === "exact_score" ? POINTS_EXACT : POINTS_OUTCOME;
}

/**
 * Computa o conjunto completo de score events de uma partida para todos
 * os palpites. Determinística: chamar 2x produz o mesmo conjunto
 * (a escrita idempotente fica por conta de copa_rescore_match).
 */
export function computeMatchEvents(
  match: Pick<
    CopaMatch,
    "stage" | "status" | "home_goals" | "away_goals" | "advanced_side" | "competition_id"
  >,
  predictions: Array<
    Pick<
      CopaPrediction,
      | "participant_id"
      | "user_id"
      | "outcome_pick"
      | "qualifier_pick"
      | "pred_home_goals"
      | "pred_away_goals"
    >
  >
): CopaScoreEventInput[] {
  const events: CopaScoreEventInput[] = [];
  for (const pred of predictions) {
    for (const reason of scorePrediction(match, pred)) {
      events.push({
        competition_id: match.competition_id,
        participant_id: pred.participant_id,
        user_id: pred.user_id,
        reason,
        points: pointsFor(reason),
      });
    }
  }
  return events;
}
