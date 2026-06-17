/**
 * Zafe Copa — orquestração da resolução de partidas.
 *
 * Usada pelo cron /api/cron/copa-resolver e pelo botão "Resolver agora"
 * do admin. Para cada partida já disputada (kickoff + 2h) e não
 * finalizada:
 *  1. consulta o oráculo (double-check com web search)
 *  2. SEMPRE grava as respostas cruas em copa_resolution_log
 *  3. veredito validado → grava resultado + roda a engine determinística
 *     + copa_rescore_match (atômico e idempotente)
 *  4. not_final → pula (tenta no próximo run)
 *  5. divergência/baixa confiança/erro → status 'under_review'
 *     (NUNCA pontua automaticamente)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatchResult, OracleCheck } from "./oracle";
import { scoreGroupPicks } from "./group-picks";
import { computeMatchEvents } from "./scoring";
import type { CopaMatch, CopaPrediction } from "./types";

const RESOLVE_GRACE_HOURS = 2;

export interface ResolveSummary {
  match_id: string;
  match_number: number;
  outcome: "applied" | "not_final" | "under_review" | "error";
  detail?: string;
}

async function logChecks(
  admin: SupabaseClient,
  matchId: string,
  checks: OracleCheck[],
  outcome: string
) {
  const rows = checks.map((c, i) => ({
    match_id: matchId,
    attempt: i + 1,
    model: "claude-haiku-4-5-20251001",
    raw_response: c.raw,
    parsed: c.verdict ?? null,
    confidence: c.verdict?.confidence ?? null,
    source_url: c.verdict?.source_url ?? null,
    outcome,
  }));
  const { error } = await admin.from("copa_resolution_log").insert(rows);
  if (error) console.error("[copa/resolve] log", error);
}

/** Aplica resultado + pontuação de UMA partida (também usada pelo admin manual). */
export async function applyMatchResult(
  admin: SupabaseClient,
  match: CopaMatch,
  result: {
    home_goals: number;
    away_goals: number;
    went_to_et: boolean;
    went_to_pens: boolean;
    advanced_side: "home" | "away" | null;
    source_url: string | null;
  }
): Promise<{ ok: boolean; events: number; error?: string }> {
  // G8: grava o resultado MAS NÃO marca 'finished' ainda. Se o rescore falhar,
  // a partida fica 'scheduled' e resolveDueMatches a re-pega no próximo run
  // (antes ela ficava 'finished' com zero score events e nunca era retentada).
  const { error: eMatch } = await admin
    .from("copa_matches")
    .update({
      home_goals: result.home_goals,
      away_goals: result.away_goals,
      went_to_et: result.went_to_et,
      went_to_pens: result.went_to_pens,
      advanced_side: result.advanced_side,
      source_url: result.source_url,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", match.id);
  if (eMatch) return { ok: false, events: 0, error: eMatch.message };

  const { data: predictions } = await admin
    .from("copa_predictions")
    .select("participant_id, user_id, outcome_pick, qualifier_pick, pred_home_goals, pred_away_goals")
    .eq("match_id", match.id);

  const events = computeMatchEvents(
    {
      stage: match.stage,
      status: "finished",
      home_goals: result.home_goals,
      away_goals: result.away_goals,
      advanced_side: result.advanced_side,
      competition_id: match.competition_id,
    },
    (predictions ?? []) as Pick<
      CopaPrediction,
      "participant_id" | "user_id" | "outcome_pick" | "qualifier_pick" | "pred_home_goals" | "pred_away_goals"
    >[]
  );

  // Atômico + idempotente: delete dos eventos antigos + insert do conjunto
  // recomputado com ON CONFLICT DO NOTHING (re-resolver nunca paga 2x).
  const { error: eScore } = await admin.rpc("copa_rescore_match", {
    p_match: match.id,
    p_events: events,
  });
  if (eScore) return { ok: false, events: 0, error: eScore.message };

  // Rescore OK → agora sim marca 'finished'.
  const { error: eFinish } = await admin
    .from("copa_matches")
    .update({ status: "finished" })
    .eq("id", match.id);
  if (eFinish) return { ok: false, events: 0, error: eFinish.message };

  // Grupo completo? Pontua os palpites de classificação (1º/2º/3º).
  // Roda DEPOIS do rescore: re-resolver o último jogo do grupo apaga os
  // eventos 'group_pick' ancorados nele, e este passo os recomputa.
  if (match.stage === "group" && match.group_name) {
    try {
      await scoreGroupPicks(admin, match.competition_id, match.group_name);
    } catch (e) {
      console.error("[copa/resolve] group picks", match.group_name, e);
    }
  }

  return { ok: true, events: events.length };
}

export async function resolveDueMatches(admin: SupabaseClient): Promise<ResolveSummary[]> {
  const cutoff = new Date(Date.now() - RESOLVE_GRACE_HOURS * 3600_000).toISOString();

  const { data: matches } = await admin
    .from("copa_matches")
    .select("*")
    .in("status", ["scheduled", "postponed"])
    .lt("kickoff_at", cutoff)
    .not("home_team", "is", null)
    .not("away_team", "is", null)
    .order("kickoff_at", { ascending: true });

  const summaries: ResolveSummary[] = [];

  for (const match of (matches ?? []) as CopaMatch[]) {
    try {
      const outcome = await fetchMatchResult(match);

      if (outcome.kind === "not_final") {
        await logChecks(admin, match.id, outcome.checks, "not_final");
        summaries.push({ match_id: match.id, match_number: match.match_number, outcome: "not_final" });
        continue;
      }

      // api_error é falha TRANSITÓRIA da API (ex.: créditos esgotados, 429,
      // timeout) — não é um veredito ambíguo. Tratar como not_final: loga e
      // deixa 'scheduled' para o próximo run re-tentar. Antes virava
      // 'under_review' (terminal) e o cron nunca re-pegava, então restaurar
      // créditos não destravava nada.
      if (outcome.kind === "review" && outcome.reason === "api_error") {
        await logChecks(admin, match.id, outcome.checks, "api_error");
        summaries.push({ match_id: match.id, match_number: match.match_number, outcome: "not_final", detail: "api_error" });
        continue;
      }

      if (outcome.kind === "review") {
        await logChecks(admin, match.id, outcome.checks, outcome.reason);
        await admin.from("copa_matches").update({ status: "under_review" }).eq("id", match.id);
        summaries.push({
          match_id: match.id,
          match_number: match.match_number,
          outcome: "under_review",
          detail: outcome.reason,
        });
        continue;
      }

      const v = outcome.verdict;
      const applied = await applyMatchResult(admin, match, {
        home_goals: v.home_goals,
        away_goals: v.away_goals,
        went_to_et: v.went_to_et,
        went_to_pens: v.went_to_pens,
        advanced_side: outcome.advancedSide,
        source_url: v.source_url,
      });
      await logChecks(admin, match.id, outcome.checks, applied.ok ? "applied" : "api_error");
      summaries.push({
        match_id: match.id,
        match_number: match.match_number,
        outcome: applied.ok ? "applied" : "error",
        detail: applied.ok ? `${applied.events} eventos` : applied.error,
      });
    } catch (e) {
      console.error("[copa/resolve]", match.match_number, e);
      summaries.push({
        match_id: match.id,
        match_number: match.match_number,
        outcome: "error",
        detail: String(e).slice(0, 200),
      });
    }
  }

  return summaries;
}
