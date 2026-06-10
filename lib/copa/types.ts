import { z } from "zod";

// ============================================================
// Zafe Copa — tipos, constantes e schemas de validação
// ============================================================

export const COPA_BUY_IN = 400;
export const POINTS_OUTCOME = 10; // vencedor (grupos) / classificado (mata-mata)
export const POINTS_EXACT = 10; // placar exato

export type CopaStage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";
export type CopaMatchStatus = "scheduled" | "postponed" | "under_review" | "finished" | "void";
export type CopaOutcome = "home" | "draw" | "away";
export type CopaSide = "home" | "away";
export type ScoreReason = "outcome" | "exact_score";

export const KNOCKOUT_STAGES: CopaStage[] = ["r32", "r16", "qf", "sf", "third", "final"];

export function isKnockout(stage: CopaStage): boolean {
  return stage !== "group";
}

export interface CopaCompetition {
  id: string;
  slug: string;
  name: string;
  buy_in: number;
  pot_total: number;
  status: "open" | "running" | "finished" | "paid" | "cancelled";
  winner_user_id: string | null;
  pot_paid_at: string | null;
  starts_at: string;
  ends_at: string;
}

export interface CopaParticipant {
  id: string;
  competition_id: string;
  user_id: string;
  join_seq: number;
  buy_in_paid: number;
  created_at: string;
}

export interface CopaMatch {
  id: string;
  competition_id: string;
  match_number: number;
  stage: CopaStage;
  group_name: string | null;
  home_team: string | null;
  away_team: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  kickoff_at: string;
  status: CopaMatchStatus;
  // Placar: fim do jogo INCLUINDO prorrogação, EXCLUINDO pênaltis.
  home_goals: number | null;
  away_goals: number | null;
  went_to_et: boolean | null;
  went_to_pens: boolean | null;
  // Classificado/vencedor (inclui pênaltis) — obrigatório no mata-mata.
  advanced_side: CopaSide | null;
  resolved_at: string | null;
  source_url: string | null;
}

export interface CopaPrediction {
  id: string;
  competition_id: string;
  match_id: string;
  participant_id: string;
  user_id: string;
  outcome_pick: CopaOutcome | null; // grupos
  qualifier_pick: CopaSide | null; // mata-mata
  pred_home_goals: number | null;
  pred_away_goals: number | null;
  created_at: string;
  updated_at: string;
}

export interface CopaScoreEventInput {
  competition_id: string;
  participant_id: string;
  user_id: string;
  reason: ScoreReason;
  points: number;
}

export interface CopaLeaderboardRow {
  competition_id: string;
  participant_id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  join_seq: number;
  points: number;
  exact_count: number;
  outcome_count: number;
  posicao: number;
}

// ------------------------------------------------------------
// Veredito do oráculo (resposta da Claude API). Anti-alucinação:
// confidence + source_url obrigatórios; veredito sem fonte é descartado.
// ------------------------------------------------------------
const goals = z.number().int().min(0).max(20);

export const oracleVerdictSchema = z.object({
  is_final: z.boolean(),
  home_goals: goals,
  away_goals: goals,
  went_to_et: z.boolean(),
  went_to_pens: z.boolean(),
  winner_team: z.string().min(1).nullable(),
  advanced_team: z.string().min(1).nullable(),
  confidence: z.number().min(0).max(1),
  source_url: z.string().url(),
});

export type OracleVerdict = z.infer<typeof oracleVerdictSchema>;

// ------------------------------------------------------------
// Input de palpite (server-side). Regras:
//  * grupos: outcome_pick obrigatório (1X2)
//  * mata-mata: qualifier_pick obrigatório (classificado)
//  * placar: opcional, mas ambos-ou-nenhum, inteiros 0–20
// ------------------------------------------------------------
const scoreFields = {
  pred_home_goals: goals.nullish(),
  pred_away_goals: goals.nullish(),
};

export const predictionInputSchema = z
  .discriminatedUnion("stage", [
    z.object({
      stage: z.literal("group"),
      match_id: z.string().uuid(),
      outcome_pick: z.enum(["home", "draw", "away"]),
      ...scoreFields,
    }),
    z.object({
      stage: z.enum(["r32", "r16", "qf", "sf", "third", "final"]),
      match_id: z.string().uuid(),
      qualifier_pick: z.enum(["home", "away"]),
      ...scoreFields,
    }),
  ])
  .refine(
    (p) => (p.pred_home_goals == null) === (p.pred_away_goals == null),
    { message: "Informe o placar completo (os dois lados) ou deixe em branco" }
  );

export type PredictionInput = z.infer<typeof predictionInputSchema>;
