import { describe, expect, it } from "vitest";
import { computeMatchEvents } from "../scoring";
import type { CopaMatch, CopaPrediction } from "../types";

type MatchInput = Pick<
  CopaMatch,
  "stage" | "status" | "home_goals" | "away_goals" | "advanced_side" | "competition_id"
>;
type PredInput = Pick<
  CopaPrediction,
  | "participant_id"
  | "user_id"
  | "outcome_pick"
  | "qualifier_pick"
  | "pred_home_goals"
  | "pred_away_goals"
>;

const COMP = "comp-1";

const match = (home: number, away: number): MatchInput => ({
  stage: "group",
  status: "finished",
  home_goals: home,
  away_goals: away,
  advanced_side: null,
  competition_id: COMP,
});

const preds: PredInput[] = [
  {
    participant_id: "p1",
    user_id: "u1",
    outcome_pick: "home",
    qualifier_pick: null,
    pred_home_goals: 2,
    pred_away_goals: 1,
  }, // +20
  {
    participant_id: "p2",
    user_id: "u2",
    outcome_pick: "home",
    qualifier_pick: null,
    pred_home_goals: 1,
    pred_away_goals: 0,
  }, // +10
  {
    participant_id: "p3",
    user_id: "u3",
    outcome_pick: "away",
    qualifier_pick: null,
    pred_home_goals: 0,
    pred_away_goals: 1,
  }, // 0
];

describe("determinismo / idempotência da engine", () => {
  it("processar 2x produz exatamente o mesmo conjunto de eventos", () => {
    const a = computeMatchEvents(match(2, 1), preds);
    const b = computeMatchEvents(match(2, 1), preds);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3); // p1: outcome+exact, p2: outcome, p3: nada
  });

  it("nunca gera evento duplicado (match, participant, reason)", () => {
    const events = computeMatchEvents(match(2, 1), preds);
    const keys = events.map((e) => `${e.participant_id}:${e.reason}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reversão: resultado corrigido → conjunto recomputado muda como esperado", () => {
    // Resultado original 2-1 (home): p1 +20, p2 +10
    const before = computeMatchEvents(match(2, 1), preds);
    expect(before.filter((e) => e.participant_id === "p1")).toHaveLength(2);
    expect(before.filter((e) => e.participant_id === "p3")).toHaveLength(0);

    // Correção: na verdade foi 0-1 (away): só p3 pontua (+20)
    const after = computeMatchEvents(match(0, 1), preds);
    expect(after.filter((e) => e.participant_id === "p1")).toHaveLength(0);
    expect(after.filter((e) => e.participant_id === "p2")).toHaveLength(0);
    expect(after.filter((e) => e.participant_id === "p3").map((e) => e.reason).sort()).toEqual([
      "exact_score",
      "outcome",
    ]);
  });

  it("todos os eventos valem 10 pontos e carregam competition_id", () => {
    const events = computeMatchEvents(match(2, 1), preds);
    for (const e of events) {
      expect(e.points).toBe(10);
      expect(e.competition_id).toBe(COMP);
    }
  });
});
