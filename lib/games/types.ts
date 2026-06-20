import { z } from "zod";

// ============================================================
// Zafe Games — tipos, constantes e schemas de validação.
// Módulo de bolão de e-sports (ver modules/games/COMPLIANCE.md).
// ============================================================

export const POINTS_CORRECT_PICK = 10; // acerto do lado vencedor (modo grátis)

export type GameKind =
  | "free_fire"
  | "valorant"
  | "cs2"
  | "lol"
  | "ea_fc"
  | "fortnite"
  | "gta"
  | "clash_royale"
  | "rocket_league"
  | "dota2"
  | "pubg"
  | "codm"
  | "r6"
  | "outros";

// Catálogo dos jogos válidos (espelha o CHECK games_event_game_check).
// "outros" fica por último — usa custom_game (nome digitado pelo criador).
export const GAME_KINDS: GameKind[] = [
  "free_fire",
  "valorant",
  "cs2",
  "lol",
  "ea_fc",
  "fortnite",
  "gta",
  "clash_royale",
  "rocket_league",
  "dota2",
  "pubg",
  "codm",
  "r6",
  "outros",
];
export type GamesMode = "free" | "pot";
export type GamesEventStatus =
  | "scheduled"
  | "live"
  | "under_review"
  | "finished"
  | "cancelled";
export type GamesSide = "a" | "b";
export type GamesSettleStatus = "pending" | "won" | "lost" | "refunded";
export type GamesTier =
  | "ferro"
  | "bronze"
  | "prata"
  | "ouro"
  | "platina"
  | "diamante"
  | "mestre";

export const GAME_LABELS: Record<GameKind, string> = {
  free_fire: "Free Fire",
  valorant: "Valorant",
  cs2: "CS2",
  lol: "League of Legends",
  ea_fc: "EA FC",
  fortnite: "Fortnite",
  gta: "GTA",
  clash_royale: "Clash Royale",
  rocket_league: "Rocket League",
  dota2: "Dota 2",
  pubg: "PUBG",
  codm: "Call of Duty Mobile",
  r6: "Rainbow Six",
  outros: "Outro",
};

// Nome exibido de um evento: usa custom_game quando o jogo é "outros".
export function gameDisplayName(game: GameKind, customGame?: string | null): string {
  if (game === "outros") return customGame?.trim() || "Outro";
  return GAME_LABELS[game];
}

// Limiares de rank derivados de events_won — DEVE espelhar games_recalc_stats
// no banco (a verdade é o servidor; isto é só para exibição).
export const TIER_THRESHOLDS: Array<{ tier: GamesTier; minWins: number; label: string }> = [
  { tier: "mestre", minWins: 400, label: "Mestre" },
  { tier: "diamante", minWins: 200, label: "Diamante" },
  { tier: "platina", minWins: 100, label: "Platina" },
  { tier: "ouro", minWins: 50, label: "Ouro" },
  { tier: "prata", minWins: 25, label: "Prata" },
  { tier: "bronze", minWins: 10, label: "Bronze" },
  { tier: "ferro", minWins: 0, label: "Ferro" },
];

export const TIER_LABELS: Record<GamesTier, string> = {
  ferro: "Ferro",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  platina: "Platina",
  diamante: "Diamante",
  mestre: "Mestre",
};

export function tierForWins(wins: number): GamesTier {
  return TIER_THRESHOLDS.find((t) => wins >= t.minWins)?.tier ?? "ferro";
}

// Progressão de rank: a partir das vitórias atuais, o próximo tier e quantas
// vitórias ainda faltam. Retorna null quando já está no rank máximo (Mestre).
export function nextTierProgress(wins: number): {
  next: GamesTier;
  label: string;
  winsNeeded: number;
  currentFloor: number;
  nextFloor: number;
} | null {
  // TIER_THRESHOLDS está em ordem decrescente; ordenamos crescente para achar
  // o primeiro patamar acima das vitórias atuais.
  const ascending = [...TIER_THRESHOLDS].sort((a, b) => a.minWins - b.minWins);
  const current = tierForWins(wins);
  const currentFloor = ascending.find((t) => t.tier === current)?.minWins ?? 0;
  const next = ascending.find((t) => t.minWins > wins);
  if (!next) return null; // já é Mestre
  return {
    next: next.tier,
    label: next.label,
    winsNeeded: next.minWins - wins,
    currentFloor,
    nextFloor: next.minWins,
  };
}

export interface GamesEvent {
  id: string;
  game: GameKind;
  custom_game: string | null; // nome livre quando game = 'outros'
  tournament: string | null;
  side_a: string;
  side_b: string;
  mode: GamesMode;
  buy_in: number;
  pot_total: number;
  closes_at: string;
  starts_at: string;
  status: GamesEventStatus;
  winner: GamesSide | null;
  pot_paid_at: string | null;
  resolved_at: string | null;
  provider: string | null;
  external_id: string | null;
  source_url: string | null;
  creator_id: string | null; // null = evento oficial (admin/cron)
  created_at: string;
}

export interface GamesPrediction {
  id: string;
  event_id: string;
  user_id: string;
  pick: GamesSide;
  buy_in_paid: number;
  settle_status: GamesSettleStatus;
  payout: number | null;
  created_at: string;
  updated_at: string;
}

export interface GamesUserStats {
  user_id: string;
  events_played: number;
  events_won: number;
  points_total: number;
  current_streak: number;
  best_streak: number;
  current_tier: GamesTier;
  updated_at: string;
}

export interface GamesLeaderboardRow {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  events_played: number;
  events_won: number;
  points_total: number;
  best_streak: number;
  current_tier: GamesTier;
  posicao: number;
}

export interface GamesStreamer {
  id: string;
  user_id: string;
  code: string;
  display_name: string;
  status: "active" | "suspended";
  rev_share_pct: number;
  created_at: string;
}

// ------------------------------------------------------------
// Input de palpite (server-side). pick obrigatório; o resto (modo,
// deadline, buy-in) é decidido pelo BANCO, nunca pelo client.
// ------------------------------------------------------------
export const predictionInputSchema = z.object({
  event_id: z.string().uuid(),
  pick: z.enum(["a", "b"]),
});

export type PredictionInput = z.infer<typeof predictionInputSchema>;

// Veredito do provedor de resultados (anti-alucinação: confiança + fonte).
export const resultVerdictSchema = z.object({
  is_final: z.boolean(),
  winner: z.enum(["a", "b"]).nullable(),
  confidence: z.number().min(0).max(1),
  source_url: z.string().url().nullable(),
});

export type ResultVerdict = z.infer<typeof resultVerdictSchema>;
