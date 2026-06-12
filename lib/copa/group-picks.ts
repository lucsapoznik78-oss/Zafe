/**
 * Zafe Copa — palpite de classificação por grupo (1º/2º/3º).
 *
 * Helpers puros (times, prazo, classificação) + pontuação:
 * quando os 6 jogos de um grupo terminam, cada posição exata do
 * palpite vale +10 (reason 'group_pick'), ancorada no ÚLTIMO jogo
 * do grupo no ledger copa_score_events. Recompute idempotente:
 * delete + insert dos eventos 'group_pick' do grupo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CopaMatch } from "./types";
import { POINTS_GROUP_POSITION } from "./types";

/** Times do grupo (a partir do fixture). */
export function groupTeams(matches: Pick<CopaMatch, "home_team" | "away_team">[]): string[] {
  const teams = new Set<string>();
  for (const m of matches) {
    if (m.home_team) teams.add(m.home_team);
    if (m.away_team) teams.add(m.away_team);
  }
  return Array.from(teams).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/**
 * Prazo de edição: kickoff da ÚLTIMA rodada do grupo (os 2 jogos finais
 * são simultâneos). Com os jogos em ordem de kickoff, é o horário do
 * penúltimo jogo.
 */
export function groupLockAt(matches: Pick<CopaMatch, "kickoff_at">[]): string | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  );
  return sorted[Math.max(0, sorted.length - 2)].kickoff_at;
}

interface StandingRow {
  team: string;
  pts: number;
  gd: number;
  gf: number;
}

/**
 * Classificação do grupo a partir dos jogos finalizados.
 * Critérios: pontos → saldo → gols pró → ordem alfabética (aproximação
 * determinística dos critérios FIFA; confronto direto/fair play são
 * raríssimos como desempate final).
 */
export function computeGroupStandings(
  matches: Pick<CopaMatch, "home_team" | "away_team" | "home_goals" | "away_goals" | "status">[]
): string[] {
  const rows = new Map<string, StandingRow>();
  const ensure = (team: string) => {
    if (!rows.has(team)) rows.set(team, { team, pts: 0, gd: 0, gf: 0 });
    return rows.get(team)!;
  };

  for (const m of matches) {
    if (m.status !== "finished" || !m.home_team || !m.away_team) continue;
    if (m.home_goals == null || m.away_goals == null) continue;
    const home = ensure(m.home_team);
    const away = ensure(m.away_team);
    home.gf += m.home_goals;
    home.gd += m.home_goals - m.away_goals;
    away.gf += m.away_goals;
    away.gd += m.away_goals - m.home_goals;
    if (m.home_goals > m.away_goals) home.pts += 3;
    else if (m.home_goals < m.away_goals) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  }

  return Array.from(rows.values())
    .sort(
      (a, b) =>
        b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "pt-BR")
    )
    .map((r) => r.team);
}

/**
 * Pontua os palpites de classificação de UM grupo, se ele já terminou
 * (6 jogos finished). Idempotente: apaga e regrava os eventos
 * 'group_pick' do jogo-âncora (último jogo do grupo).
 */
export async function scoreGroupPicks(
  admin: SupabaseClient,
  competitionId: string,
  groupName: string
): Promise<{ scored: boolean; events: number }> {
  const { data: matches } = await admin
    .from("copa_matches")
    .select("id, home_team, away_team, home_goals, away_goals, status, kickoff_at, match_number")
    .eq("competition_id", competitionId)
    .eq("stage", "group")
    .eq("group_name", groupName);

  const ms = (matches ?? []) as Array<
    Pick<CopaMatch, "id" | "home_team" | "away_team" | "home_goals" | "away_goals" | "status" | "kickoff_at" | "match_number">
  >;
  if (ms.length === 0) return { scored: false, events: 0 };
  // Grupo só pontua completo (jogos void não contam como completos)
  if (!ms.every((m) => m.status === "finished")) return { scored: false, events: 0 };

  const standings = computeGroupStandings(ms);
  if (standings.length < 3) return { scored: false, events: 0 };
  const top3 = standings.slice(0, 3);

  // Âncora: último jogo do grupo (kickoff mais tarde; desempate por nº FIFA)
  const anchor = [...ms].sort(
    (a, b) =>
      new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime() ||
      b.match_number - a.match_number
  )[0];

  const { data: picks } = await admin
    .from("copa_group_picks")
    .select("participant_id, user_id, first_team, second_team, third_team")
    .eq("competition_id", competitionId)
    .eq("group_name", groupName);

  // Recompute idempotente dos eventos do grupo
  await admin
    .from("copa_score_events")
    .delete()
    .eq("match_id", anchor.id)
    .eq("reason", "group_pick");

  const events = (picks ?? [])
    .map((p) => {
      const hits =
        (p.first_team === top3[0] ? 1 : 0) +
        (p.second_team === top3[1] ? 1 : 0) +
        (p.third_team === top3[2] ? 1 : 0);
      return {
        competition_id: competitionId,
        match_id: anchor.id,
        participant_id: p.participant_id,
        user_id: p.user_id,
        reason: "group_pick",
        points: hits * POINTS_GROUP_POSITION,
      };
    })
    .filter((e) => e.points > 0);

  if (events.length > 0) {
    const { error } = await admin.from("copa_score_events").insert(events);
    if (error) {
      console.error("[copa/group-picks] insert score events", error);
      return { scored: false, events: 0 };
    }
  }

  return { scored: true, events: events.length };
}
