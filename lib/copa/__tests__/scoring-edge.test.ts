import { describe, expect, it } from "vitest";
import { computeMatchEvents, scorePrediction } from "../scoring";
import { predictionInputSchema } from "../types";
import type { CopaMatch, CopaMatchStatus, CopaPrediction } from "../types";

type PredInput = Pick<
  CopaPrediction,
  | "participant_id"
  | "user_id"
  | "outcome_pick"
  | "qualifier_pick"
  | "pred_home_goals"
  | "pred_away_goals"
>;

const perfectPred: PredInput = {
  participant_id: "p1",
  user_id: "u1",
  outcome_pick: "home",
  qualifier_pick: null,
  pred_home_goals: 2,
  pred_away_goals: 1,
};

const matchWithStatus = (status: CopaMatchStatus) =>
  ({
    stage: "group",
    status,
    home_goals: 2,
    away_goals: 1,
    advanced_side: null,
    competition_id: "comp-1",
  }) satisfies Pick<
    CopaMatch,
    "stage" | "status" | "home_goals" | "away_goals" | "advanced_side" | "competition_id"
  >;

describe("status da partida", () => {
  it("void → zero eventos mesmo com palpite perfeito", () => {
    expect(computeMatchEvents(matchWithStatus("void"), [perfectPred])).toEqual([]);
  });

  it("scheduled/postponed/under_review → zero eventos", () => {
    for (const status of ["scheduled", "postponed", "under_review"] as const) {
      expect(computeMatchEvents(matchWithStatus(status), [perfectPred])).toEqual([]);
    }
  });

  it("finished sem placar gravado (dado inconsistente) → zero eventos", () => {
    const m = { ...matchWithStatus("finished"), home_goals: null, away_goals: null };
    expect(scorePrediction(m, perfectPred)).toEqual([]);
  });
});

describe("entrada tardia", () => {
  it("participante sem palpites em jogos passados → zero eventos (0 pontos)", () => {
    // entrou depois: simplesmente não há linha de prediction para ele
    expect(computeMatchEvents(matchWithStatus("finished"), [])).toEqual([]);
  });
});

describe("validação de input de palpite (zod)", () => {
  const base = {
    stage: "group" as const,
    match_id: "8d8ac610-566d-4ef0-9c22-186b2a5ed793",
    outcome_pick: "home" as const,
  };

  it("aceita palpite válido com placar", () => {
    const r = predictionInputSchema.safeParse({
      ...base,
      pred_home_goals: 2,
      pred_away_goals: 1,
    });
    expect(r.success).toBe(true);
  });

  it("aceita palpite sem placar (só vencedor)", () => {
    expect(predictionInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejeita gols acima do teto (21)", () => {
    const r = predictionInputSchema.safeParse({
      ...base,
      pred_home_goals: 21,
      pred_away_goals: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita gols negativos", () => {
    const r = predictionInputSchema.safeParse({
      ...base,
      pred_home_goals: -1,
      pred_away_goals: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita gols fracionados (2.5)", () => {
    const r = predictionInputSchema.safeParse({
      ...base,
      pred_home_goals: 2.5,
      pred_away_goals: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita NaN e lixo", () => {
    expect(
      predictionInputSchema.safeParse({ ...base, pred_home_goals: NaN, pred_away_goals: 0 })
        .success
    ).toBe(false);
    expect(
      predictionInputSchema.safeParse({ ...base, pred_home_goals: "dois", pred_away_goals: 0 })
        .success
    ).toBe(false);
  });

  it("rejeita placar incompleto (um lado só)", () => {
    const r = predictionInputSchema.safeParse({ ...base, pred_home_goals: 2 });
    expect(r.success).toBe(false);
  });

  it("grupos: rejeita sem outcome_pick", () => {
    const r = predictionInputSchema.safeParse({
      stage: "group",
      match_id: base.match_id,
    });
    expect(r.success).toBe(false);
  });

  it("mata-mata: exige qualifier_pick e aceita placar de empate", () => {
    const ko = {
      stage: "r16" as const,
      match_id: base.match_id,
      qualifier_pick: "away" as const,
      pred_home_goals: 1,
      pred_away_goals: 1, // empate é palpite válido (pênaltis decidem)
    };
    expect(predictionInputSchema.safeParse(ko).success).toBe(true);
    expect(
      predictionInputSchema.safeParse({ stage: "r16", match_id: base.match_id }).success
    ).toBe(false);
  });

  it("mata-mata: rejeita 'draw' como classificado", () => {
    const r = predictionInputSchema.safeParse({
      stage: "final",
      match_id: base.match_id,
      qualifier_pick: "draw",
    });
    expect(r.success).toBe(false);
  });
});
