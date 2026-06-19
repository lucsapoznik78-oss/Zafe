import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GamesEvent,
  GamesLeaderboardRow,
  GamesPrediction,
  GamesUserStats,
} from "./types";

// ============================================================
// Zafe Games — leituras server-side.
// Usam o client RLS do usuário: as policies já garantem que
// palpites dos outros só aparecem após o lock (closes_at).
// ============================================================

// Mapa de filtro de aba → status do evento.
export const STATUS_FILTERS: Record<string, GamesEvent["status"][]> = {
  proximos: ["scheduled"],
  ao_vivo: ["live", "under_review"],
  encerrados: ["finished", "cancelled"],
};

export async function getEvents(
  supabase: SupabaseClient,
  filter?: { status?: string; game?: string }
): Promise<GamesEvent[]> {
  let q = supabase
    .from("games_event")
    .select("*")
    .order("starts_at", { ascending: true });

  const statuses = filter?.status ? STATUS_FILTERS[filter.status] : undefined;
  if (statuses) q = q.in("status", statuses);
  if (filter?.game) q = q.eq("game", filter.game);

  const { data } = await q;
  return data ?? [];
}

export async function getEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<GamesEvent | null> {
  const { data } = await supabase
    .from("games_event")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  return data;
}

export async function getUserPredictions(
  supabase: SupabaseClient,
  userId: string
): Promise<GamesPrediction[]> {
  const { data } = await supabase
    .from("games_prediction")
    .select("*")
    .eq("user_id", userId);
  return data ?? [];
}

export async function getUserPrediction(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<GamesPrediction | null> {
  const { data } = await supabase
    .from("games_prediction")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<GamesUserStats | null> {
  const { data } = await supabase
    .from("games_user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getLeaderboard(
  supabase: SupabaseClient,
  limit = 100
): Promise<GamesLeaderboardRow[]> {
  const { data } = await supabase
    .from("v_games_leaderboard")
    .select("*")
    .order("posicao", { ascending: true })
    .limit(limit);
  return data ?? [];
}
