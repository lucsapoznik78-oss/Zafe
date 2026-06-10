import { describe, expect, it } from "vitest";
import { outcomeFromScore, scorePrediction } from "../scoring";
import type { CopaMatch, CopaPrediction } from "../types";

type MatchInput = Pick<
  CopaMatch,
  "stage" | "status" | "home_goals" | "away_goals" | "advanced_side"
>;
type PredInput = Pick<
  CopaPrediction,
  "outcome_pick" | "qualifier_pick" | "pred_home_goals" | "pred_away_goals"
>;

const groupMatch = (home: number, away: number): MatchInput => ({
  stage: "group",
  status: "finished",
  home_goals: home,
  away_goals: away,
  advanced_side: null,
});

const pred = (p: Partial<PredInput>): PredInput => ({
  outcome_pick: null,
  qualifier_pick: null,
  pred_home_goals: null,
  pred_away_goals: null,
  ...p,
});

describe("outcomeFromScore", () => {
  it("home win", () => expect(outcomeFromScore(2, 1)).toBe("home"));
  it("away win", () => expect(outcomeFromScore(0, 3)).toBe("away"));
  it("draw", () => expect(outcomeFromScore(1, 1)).toBe("draw"));
  it("0-0 draw", () => expect(outcomeFromScore(0, 0)).toBe("draw"));
});

describe("fase de grupos", () => {
  it("acertou só o vencedor → +10 (outcome)", () => {
    const r = scorePrediction(
      groupMatch(2, 1),
      pred({ outcome_pick: "home", pred_home_goals: 3, pred_away_goals: 0 })
    );
    expect(r).toEqual(["outcome"]);
  });

  it("acertou o EMPATE → +10 (outcome)", () => {
    const r = scorePrediction(
      groupMatch(1, 1),
      pred({ outcome_pick: "draw", pred_home_goals: 0, pred_away_goals: 0 })
    );
    expect(r).toEqual(["outcome"]);
  });

  it("placar exato implica vencedor → +20 (outcome + exact_score)", () => {
    const r = scorePrediction(
      groupMatch(2, 1),
      pred({ outcome_pick: "home", pred_home_goals: 2, pred_away_goals: 1 })
    );
    expect(r).toEqual(["outcome", "exact_score"]);
  });

  it("placar exato de empate → +20", () => {
    const r = scorePrediction(
      groupMatch(0, 0),
      pred({ outcome_pick: "draw", pred_home_goals: 0, pred_away_goals: 0 })
    );
    expect(r).toEqual(["outcome", "exact_score"]);
  });

  it("errou tudo → 0", () => {
    const r = scorePrediction(
      groupMatch(2, 1),
      pred({ outcome_pick: "away", pred_home_goals: 0, pred_away_goals: 2 })
    );
    expect(r).toEqual([]);
  });

  it("sem palpite → 0", () => {
    expect(scorePrediction(groupMatch(2, 1), null)).toEqual([]);
  });

  it("palpite só de vencedor (sem placar) → no máximo +10", () => {
    const r = scorePrediction(groupMatch(2, 1), pred({ outcome_pick: "home" }));
    expect(r).toEqual(["outcome"]);
  });

  it("placar invertido não conta como exato", () => {
    // previu 1-2, deu 2-1: errou vencedor E placar
    const r = scorePrediction(
      groupMatch(2, 1),
      pred({ outcome_pick: "away", pred_home_goals: 1, pred_away_goals: 2 })
    );
    expect(r).toEqual([]);
  });
});
