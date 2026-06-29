/**
 * Zafe Copa — avanço automático do chaveamento (mata-mata).
 *
 * Os 32 jogos de mata-mata nascem com PLACEHOLDERS no lugar dos times
 * (migration 028); os times reais só são conhecidos conforme a Copa avança.
 * Este módulo resolve esses placeholders a partir do estado atual da
 * competição e preenche home_team/away_team — o que, por sua vez, abre os
 * palpites (a rota /api/copa/palpitar exige os dois times definidos).
 *
 * Três tipos de placeholder:
 *  - "1A" / "2B" / "3C" → posição N da classificação do grupo X (1º/2º/3º)
 *  - "V73" → vencedor (classificado) do jogo 73; "P101" → perdedor do 101
 *  - "3A/3B/3C/3D/3F" → um dos 8 melhores 3ºs lugares; o slot aceita só
 *    certos grupos (tabela oficial FIFA 2026 embutida nos placeholders).
 *
 * A atribuição dos melhores 3ºs é resolvida por matching perfeito sobre os
 * conjuntos de grupos permitidos de cada slot: quando há UMA única atribuição
 * válida (o caso esmagador, e sempre o caso real do torneio), preenche
 * automaticamente; se ficar ambíguo, deixa pro admin (fill_slot). Puro/idempotente:
 * só preenche slots vazios, nunca sobrescreve um time já definido.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CopaMatch } from "./types";
import { computeGroupTable, type StandingRow } from "./group-picks";

type GroupTables = Map<string, StandingRow[]>;

const POSITION_RE = /^([123])([A-L])$/;
const WINNER_RE = /^V(\d+)$/;
const LOSER_RE = /^P(\d+)$/;
const THIRD_SLOT_RE = /^3[A-L](\/3[A-L])+$/;
const HOME_GROUP_RE = /^1([A-L])$/;

/**
 * Tabela oficial FIFA de alocação dos 8 melhores 3ºs no round of 32.
 * Chave: os 8 grupos cujo 3º colocado se classificou, em ordem alfabética,
 * separados por vírgula. Valor: para cada GRUPO VENCEDOR (que recebe um 3º
 * como adversário), qual GRUPO fornece esse 3º colocado. É independente do
 * fixture: o slot é identificado pelo home_placeholder "1X" da partida.
 *
 * A FIFA define 495 combinações (C(12,8)); aqui codificamos as que ocorrem.
 * A combinação real da Copa 2026 (grupos B,D,E,F,I,J,K,L — "Combinação 67")
 * está verificada contra o chaveamento oficial. Combinação ausente → os 8
 * slots ficam para preenchimento manual do admin (fill_slot).
 */
const THIRD_PLACE_ALLOCATION: Record<string, Record<string, string>> = {
  // Combinação 67 — Copa 2026 (verificada): 1A×3E, 1B×3J, 1D×3B, 1E×3D,
  // 1G×3I, 1I×3F, 1K×3L, 1L×3K.
  "B,D,E,F,I,J,K,L": { A: "E", B: "J", D: "B", E: "D", G: "I", I: "F", K: "L", L: "K" },
};

/** Times reais de uma partida resolvida (classificado/perdedor). */
function advancedTeam(m: CopaMatch): string | null {
  if (m.status !== "finished" || !m.advanced_side) return null;
  return m.advanced_side === "home" ? m.home_team : m.away_team;
}
function eliminatedTeam(m: CopaMatch): string | null {
  if (m.status !== "finished" || !m.advanced_side) return null;
  return m.advanced_side === "home" ? m.away_team : m.home_team;
}

/** Grupo está completo (todos os jogos finalizados) e tem 4 times na tabela. */
function groupComplete(
  groupMatches: CopaMatch[],
  table: StandingRow[]
): boolean {
  return (
    groupMatches.length > 0 &&
    groupMatches.every((m) => m.status === "finished") &&
    table.length >= 3
  );
}

/**
 * Classificação dos 8 melhores 3ºs colocados → atribuição grupo→slot.
 * Retorna um mapa match_number → nome do time (3º colocado) para os slots
 * de melhor-3º, OU vazio se ainda não dá pra determinar / atribuição ambígua.
 */
export function assignBestThirds(
  matches: CopaMatch[],
  groupTables: GroupTables,
  groupMatchesByName: Map<string, CopaMatch[]>
): Map<number, string> {
  const result = new Map<number, string>();

  // 1. 3º colocado de cada grupo — exige TODOS os grupos completos
  //    (a classificação dos melhores 3ºs depende dos 12 grupos).
  const thirds: { group: string; row: StandingRow }[] = [];
  for (const [name, table] of groupTables) {
    const gm = groupMatchesByName.get(name) ?? [];
    if (!groupComplete(gm, table)) return result; // ainda não dá pra ranquear
    thirds.push({ group: name, row: table[2] });
  }
  if (thirds.length < 12) return result;

  // 2. Ranqueia os 3ºs (mesmos critérios da tabela de grupo) e pega os 8 melhores.
  thirds.sort(
    (a, b) =>
      b.row.pts - a.row.pts ||
      b.row.gd - a.row.gd ||
      b.row.gf - a.row.gf ||
      a.group.localeCompare(b.group)
  );
  const qualifying = thirds.slice(0, 8);
  const teamByGroup = new Map(qualifying.map((t) => [t.group, t.row.team]));
  const key = qualifying.map((t) => t.group).sort().join(",");

  // 3. Tabela oficial FIFA: grupo vencedor → grupo do 3º adversário.
  const alloc = THIRD_PLACE_ALLOCATION[key];
  if (!alloc) return result; // combinação não codificada → admin preenche

  // 4. Cada slot de melhor-3º é identificado pelo grupo vencedor no home_placeholder.
  for (const m of matches) {
    if (!m.away_placeholder || !THIRD_SLOT_RE.test(m.away_placeholder)) continue;
    const hg = m.home_placeholder ? HOME_GROUP_RE.exec(m.home_placeholder) : null;
    if (!hg) continue;
    const thirdGroup = alloc[hg[1]];
    const team = thirdGroup ? teamByGroup.get(thirdGroup) : undefined;
    if (team) result.set(m.match_number, team);
  }
  return result;
}

/**
 * Resolve um placeholder para um nome de time, ou null se ainda indeterminado.
 * `side` indica se é o slot home/away da partida `selfNumber` (para os
 * melhores 3ºs, que sempre caem no lado away).
 */
function resolvePlaceholder(
  placeholder: string | null,
  ctx: {
    byNumber: Map<number, CopaMatch>;
    groupTables: GroupTables;
    groupMatchesByName: Map<string, CopaMatch[]>;
    bestThirds: Map<number, string>;
    selfNumber: number;
  }
): string | null {
  if (!placeholder) return null;

  const pos = POSITION_RE.exec(placeholder);
  if (pos) {
    const n = Number(pos[1]);
    const group = pos[2];
    const table = ctx.groupTables.get(group) ?? [];
    const gm = ctx.groupMatchesByName.get(group) ?? [];
    if (!groupComplete(gm, table)) return null;
    return table[n - 1]?.team ?? null;
  }

  const win = WINNER_RE.exec(placeholder);
  if (win) {
    const src = ctx.byNumber.get(Number(win[1]));
    return src ? advancedTeam(src) : null;
  }

  const lose = LOSER_RE.exec(placeholder);
  if (lose) {
    const src = ctx.byNumber.get(Number(lose[1]));
    return src ? eliminatedTeam(src) : null;
  }

  if (THIRD_SLOT_RE.test(placeholder)) {
    return ctx.bestThirds.get(ctx.selfNumber) ?? null;
  }

  return null;
}

export interface AdvanceSummary {
  match_number: number;
  home_team?: string;
  away_team?: string;
}

/**
 * Preenche home_team/away_team das partidas de mata-mata cujos placeholders
 * já estão determinados pelo estado atual. Idempotente: pula slots já
 * preenchidos. Retorna o que foi preenchido nesta passada.
 */
export async function advanceBracket(
  admin: SupabaseClient,
  competitionId: string
): Promise<AdvanceSummary[]> {
  const { data } = await admin
    .from("copa_matches")
    .select(
      "id, match_number, stage, group_name, home_team, away_team, home_placeholder, away_placeholder, status, home_goals, away_goals, advanced_side"
    )
    .eq("competition_id", competitionId);

  const matches = (data ?? []) as CopaMatch[];
  if (matches.length === 0) return [];

  const byNumber = new Map(matches.map((m) => [m.match_number, m]));
  const groupMatchesByName = new Map<string, CopaMatch[]>();
  for (const m of matches) {
    if (m.stage === "group" && m.group_name) {
      const arr = groupMatchesByName.get(m.group_name) ?? [];
      arr.push(m);
      groupMatchesByName.set(m.group_name, arr);
    }
  }
  const groupTables: GroupTables = new Map();
  for (const [name, gm] of groupMatchesByName) {
    groupTables.set(name, computeGroupTable(gm));
  }

  const bestThirds = assignBestThirds(matches, groupTables, groupMatchesByName);

  const summaries: AdvanceSummary[] = [];

  for (const m of matches) {
    if (m.stage === "group" || m.status === "finished" || m.status === "void") continue;

    const update: { home_team?: string; away_team?: string } = {};
    if (!m.home_team) {
      const t = resolvePlaceholder(m.home_placeholder, {
        byNumber,
        groupTables,
        groupMatchesByName,
        bestThirds,
        selfNumber: m.match_number,
      });
      if (t) update.home_team = t;
    }
    if (!m.away_team) {
      const t = resolvePlaceholder(m.away_placeholder, {
        byNumber,
        groupTables,
        groupMatchesByName,
        bestThirds,
        selfNumber: m.match_number,
      });
      if (t) update.away_team = t;
    }

    if (update.home_team || update.away_team) {
      const { error } = await admin.from("copa_matches").update(update).eq("id", m.id);
      if (error) {
        console.error("[copa/bracket] fill", m.match_number, error);
        continue;
      }
      summaries.push({ match_number: m.match_number, ...update });
    }
  }

  return summaries;
}
