/**
 * Zafe Games — orquestração da resolução de eventos.
 *
 * Usada pelo cron /api/cron/games-resolver e pelo botão de resolução manual
 * do admin. Para cada evento já iniciado (starts_at + grace) e não finalizado:
 *  1. consulta o provedor de resultados (adapter trocável)
 *  2. SEMPRE grava a resposta crua em games_resolution_log
 *  3. veredito confiável → applyEventResult (pontos + pote + stats, atômico)
 *  4. não-final / sem confiança → 'under_review' (NUNCA paga automático)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GamesEvent, GamesSide } from "./types";
import { POINTS_CORRECT_PICK } from "./types";
import { getResultsProvider, isTrustworthy } from "./resultsProvider";

const RESOLVE_GRACE_MINUTES = 30;

export interface ResolveSummary {
  event_id: string;
  outcome: "applied" | "not_final" | "under_review" | "error";
  detail?: string;
}

/**
 * Aplica o resultado de UM evento (também usada na resolução manual do admin):
 *  - registra o vencedor;
 *  - pontua (modo grátis: +10 a quem acertou — idempotente por UNIQUE);
 *  - liquida o pote (modo pote) via games_pot_settle (atômico/idempotente);
 *  - recalcula stats/ranks server-side de cada participante.
 */
export async function applyEventResult(
  admin: SupabaseClient,
  event: GamesEvent,
  winner: GamesSide,
  sourceUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  // Participantes (para pontuação e recálculo de stats).
  const { data: predictions } = await admin
    .from("games_prediction")
    .select("user_id, pick")
    .eq("event_id", event.id);

  // Pontos internos (gamificação) — NUNCA Z$. Idempotente via UNIQUE
  // (event_id, user_id, reason): re-resolver não pontua 2x.
  const winners = (predictions ?? []).filter((p) => p.pick === winner);
  if (winners.length > 0) {
    const scoreRows = winners.map((p) => ({
      event_id: event.id,
      user_id: p.user_id,
      reason: "correct_pick",
      points: POINTS_CORRECT_PICK,
    }));
    const { error: eScore } = await admin
      .from("games_score_event")
      .upsert(scoreRows, { onConflict: "event_id,user_id,reason", ignoreDuplicates: true });
    if (eScore) return { ok: false, error: eScore.message };
  }

  if (event.mode === "pot") {
    // Liquidação atômica do pote (marca finished+winner, paga parimutuel).
    const { data, error } = await admin.rpc("games_pot_settle", {
      p_event: event.id,
      p_winner: winner,
    });
    if (error) return { ok: false, error: error.message };
    const result = data as { ok: boolean; reason?: string } | null;
    if (result && !result.ok && result.reason !== "already_paid") {
      return { ok: false, error: result.reason };
    }
    // games_pot_settle já setou status/winner/resolved_at. Grava a fonte.
    await admin.from("games_event").update({ source_url: sourceUrl }).eq("id", event.id);
  } else {
    // Modo grátis: só marca o evento finalizado com o vencedor.
    const { error: eFinish } = await admin
      .from("games_event")
      .update({
        status: "finished",
        winner,
        source_url: sourceUrl,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", event.id)
      .eq("status", event.status); // guarda contra corrida com outro resolver
    if (eFinish) return { ok: false, error: eFinish.message };
  }

  // Recalcula stats/ranks de cada participante (current_tier server-side).
  for (const p of predictions ?? []) {
    const { error } = await admin.rpc("games_recalc_stats", { p_user: p.user_id });
    if (error) console.error("[games/resolve] recalc_stats", p.user_id, error.message);
  }

  return { ok: true };
}

export async function resolveDueEvents(admin: SupabaseClient): Promise<ResolveSummary[]> {
  const cutoff = new Date(Date.now() - RESOLVE_GRACE_MINUTES * 60_000).toISOString();
  const provider = getResultsProvider();

  const { data: events } = await admin
    .from("games_event")
    .select("*")
    .in("status", ["scheduled", "live", "under_review"])
    .lt("starts_at", cutoff)
    .order("starts_at", { ascending: true });

  const summaries: ResolveSummary[] = [];

  for (const event of (events ?? []) as GamesEvent[]) {
    try {
      const verdict = await provider.fetchResult(event);

      await admin.from("games_resolution_log").insert({
        event_id: event.id,
        provider: provider.name,
        raw_response: JSON.stringify(verdict),
        parsed: verdict,
        confidence: verdict.confidence,
        source_url: verdict.source_url,
        outcome: isTrustworthy(verdict) ? "applied" : "not_final",
      });

      if (!isTrustworthy(verdict) || verdict.winner === null) {
        // Evento já passou do início mas sem veredito confiável: marca live
        // (em andamento/aguardando). Próximo run tenta de novo; admin pode
        // resolver manualmente.
        if (event.status === "scheduled") {
          await admin.from("games_event").update({ status: "live" }).eq("id", event.id);
        }
        summaries.push({ event_id: event.id, outcome: "not_final" });
        continue;
      }

      const applied = await applyEventResult(admin, event, verdict.winner, verdict.source_url);
      summaries.push({
        event_id: event.id,
        outcome: applied.ok ? "applied" : "error",
        detail: applied.error,
      });
    } catch (e) {
      console.error("[games/resolve]", event.id, e);
      summaries.push({ event_id: event.id, outcome: "error", detail: String(e).slice(0, 200) });
    }
  }

  return summaries;
}
