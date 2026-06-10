import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CopaCompetition,
  CopaLeaderboardRow,
  CopaMatch,
  CopaParticipant,
  CopaPrediction,
} from "./types";

// ============================================================
// Zafe Copa — leituras server-side.
// Usam o client RLS do usuário: as policies já garantem que
// palpites dos outros só aparecem após o kickoff.
// ============================================================

export const COPA_SLUG = "copa-2026";

export async function getCompetition(
  supabase: SupabaseClient
): Promise<CopaCompetition | null> {
  const { data } = await supabase
    .from("copa_competition")
    .select("*")
    .eq("slug", COPA_SLUG)
    .single();
  return data;
}

export async function getParticipant(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string
): Promise<CopaParticipant | null> {
  const { data } = await supabase
    .from("copa_participants")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getParticipantCount(
  supabase: SupabaseClient,
  competitionId: string
): Promise<number> {
  const { count } = await supabase
    .from("copa_participants")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  return count ?? 0;
}

export async function getMatches(
  supabase: SupabaseClient,
  competitionId: string,
  filters?: { stage?: string; group?: string }
): Promise<CopaMatch[]> {
  let q = supabase
    .from("copa_matches")
    .select("*")
    .eq("competition_id", competitionId)
    .order("kickoff_at", { ascending: true })
    .order("match_number", { ascending: true });
  if (filters?.stage) q = q.eq("stage", filters.stage);
  if (filters?.group) q = q.eq("group_name", filters.group);
  const { data } = await q;
  return data ?? [];
}

export async function getUserPredictions(
  supabase: SupabaseClient,
  competitionId: string,
  userId: string
): Promise<CopaPrediction[]> {
  const { data } = await supabase
    .from("copa_predictions")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("user_id", userId);
  return data ?? [];
}

/** Palpites de TODOS numa partida — RLS só libera após o kickoff. */
export async function getMatchPredictions(
  supabase: SupabaseClient,
  matchId: string
): Promise<Array<CopaPrediction & { profiles: { username: string; avatar_url: string | null } }>> {
  const { data } = await supabase
    .from("copa_predictions")
    .select("*, profiles(username, avatar_url)")
    .eq("match_id", matchId);
  return (data as never) ?? [];
}

export async function getLeaderboard(
  supabase: SupabaseClient,
  competitionId: string
): Promise<CopaLeaderboardRow[]> {
  const { data } = await supabase
    .from("v_copa_leaderboard")
    .select("*")
    .eq("competition_id", competitionId)
    .order("posicao", { ascending: true });
  return data ?? [];
}
