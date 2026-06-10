import { describe, expect, it } from "vitest";
import { scorePrediction } from "../scoring";
import type { CopaMatch, CopaPrediction, CopaSide, CopaStage } from "../types";

type MatchInput = Pick<
  CopaMatch,
  "stage" | "status" | "home_goals" | "away_goals" | "advanced_side"
>;
type PredInput = Pick<
  CopaPrediction,
  "outcome_pick" | "qualifier_pick" | "pred_home_goals" | "pred_away_goals"
>;

// Placar = fim da prorrogação (quando houver), SEM pênaltis.
const koMatch = (
  home: number,
  away: number,
  advanced: CopaSide,
  stage: CopaStage = "r16"
): MatchInput => ({
  stage,
  status: "finished",
  home_goals: home,
  away_goals: away,
  advanced_side: advanced,
});

const pred = (p: Partial<PredInput>): PredInput => ({
  outcome_pick: null,
  qualifier_pick: null,
  pred_home_goals: null,
  pred_away_goals: null,
  ...p,
});

describe("mata-mata — palpites desacoplados", () => {
  it("decidido nos 90 min: classificado + placar certos → +20", () => {
    const r = scorePrediction(
      koMatch(2, 0, "home"),
      pred({ qualifier_pick: "home", pred_home_goals: 2, pred_away_goals: 0 })
    );
    expect(r).toEqual(["outcome", "exact_score"]);
  });

  it("pênaltis: empate na prorrogação + classificado nos pênaltis certos → +20", () => {
    // 1-1 ao fim da prorrogação, away avança nos pênaltis;
    // usuário previu 1-1 e away classificado
    const r = scorePrediction(
      koMatch(1, 1, "away"),
      pred({ qualifier_pick: "away", pred_home_goals: 1, pred_away_goals: 1 })
    );
    expect(r).toEqual(["outcome", "exact_score"]);
  });

  it("CASO CRÍTICO: placar exato certo + classificado ERRADO → só +10 (exact_score)", () => {
    // previu 1-1 (correto) mas apostou no home avançando; away avançou nos pênaltis
    const r = scorePrediction(
      koMatch(1, 1, "away"),
      pred({ qualifier_pick: "home", pred_home_goals: 1, pred_away_goals: 1 })
    );
    expect(r).toEqual(["exact_score"]);
  });

  it("classificado certo + placar errado → só +10 (outcome)", () => {
    const r = scorePrediction(
      koMatch(2, 1, "home"),
      pred({ qualifier_pick: "home", pred_home_goals: 3, pred_away_goals: 0 })
    );
    expect(r).toEqual(["outcome"]);
  });

  it("errou tudo → 0", () => {
    const r = scorePrediction(
      koMatch(2, 0, "home"),
      pred({ qualifier_pick: "away", pred_home_goals: 0, pred_away_goals: 1 })
    );
    expect(r).toEqual([]);
  });

  it("disputa de pênaltis NÃO entra no placar exato", () => {
    // 0-0 na prorrogação, home venceu 5-4 nos pênaltis. Palpite 5-4 NÃO é exato.
    const r = scorePrediction(
      koMatch(0, 0, "home"),
      pred({ qualifier_pick: "home", pred_home_goals: 5, pred_away_goals: 4 })
    );
    expect(r).toEqual(["outcome"]);
  });

  it("outcome_pick (campo de grupos) é ignorado no mata-mata", () => {
    // palpite corrompido/legado com outcome_pick: não pontua classificado
    const r = scorePrediction(
      koMatch(2, 1, "home"),
      pred({ outcome_pick: "home", pred_home_goals: 0, pred_away_goals: 0 })
    );
    expect(r).toEqual([]);
  });

  it("sem advanced_side no resultado (dado incompleto) → não pontua classificado", () => {
    const r = scorePrediction(
      { stage: "final", status: "finished", home_goals: 1, away_goals: 1, advanced_side: null },
      pred({ qualifier_pick: "home", pred_home_goals: 1, pred_away_goals: 1 })
    );
    expect(r).toEqual(["exact_score"]);
  });

  it("vale para todas as fases de mata-mata", () => {
    for (const stage of ["r32", "r16", "qf", "sf", "third", "final"] as const) {
      const r = scorePrediction(
        koMatch(1, 0, "home", stage),
        pred({ qualifier_pick: "home", pred_home_goals: 1, pred_away_goals: 0 })
      );
      expect(r).toEqual(["outcome", "exact_score"]);
    }
  });
});
