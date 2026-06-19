/**
 * Zafe Games — provedor de resultados de e-sports (adapter trocável).
 *
 * A auto-resolução depende de uma fonte externa de resultado da partida.
 * A interface ResultsProvider isola o resto do sistema do provedor concreto
 * (PandaScore / Abios / GRID): trocar de fornecedor = trocar uma função, sem
 * mexer no resolver, no schema ou na liquidação do pote.
 *
 * Anti-alucinação: o veredito SÓ vale com is_final=true E confiança alta E
 * fonte. Qualquer dúvida → is_final:false → o resolver manda para revisão
 * manual (admin), nunca paga automático.
 */

import type { GamesEvent, ResultVerdict } from "./types";
import { resultVerdictSchema } from "./types";

export interface ResultsProvider {
  name: string;
  fetchResult(event: GamesEvent): Promise<ResultVerdict>;
}

const MIN_CONFIDENCE = 0.9;

// Provedor padrão: NÃO resolve sozinho. Sem token de provedor configurado,
// todo evento fica para resolução manual do admin (is_final:false). Isto é
// seguro por padrão — nada é pago automaticamente sem fonte confiável.
const manualProvider: ResultsProvider = {
  name: "manual",
  async fetchResult(): Promise<ResultVerdict> {
    return { is_final: false, winner: null, confidence: 0, source_url: null };
  },
};

// Adapter PandaScore (ativado por env PANDASCORE_TOKEN). Mapeia o vencedor
// da partida (event.external_id) para o lado a/b deste evento comparando o
// nome do time vencedor com side_a/side_b.
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const pandaScoreProvider: ResultsProvider = {
  name: "pandascore",
  async fetchResult(event: GamesEvent): Promise<ResultVerdict> {
    const token = process.env.PANDASCORE_TOKEN;
    if (!token || !event.external_id) {
      return { is_final: false, winner: null, confidence: 0, source_url: null };
    }
    try {
      const res = await fetch(
        `https://api.pandascore.co/matches/${encodeURIComponent(event.external_id)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) {
        return { is_final: false, winner: null, confidence: 0, source_url: null };
      }
      const data = await res.json();
      // PandaScore: status 'finished' + winner.name definem o resultado.
      if (data?.status !== "finished" || !data?.winner?.name) {
        return { is_final: false, winner: null, confidence: 0, source_url: null };
      }
      const w = normalize(String(data.winner.name));
      const a = normalize(event.side_a);
      const b = normalize(event.side_b);
      let winner: "a" | "b" | null = null;
      if (w === a || a.includes(w) || w.includes(a)) winner = "a";
      else if (w === b || b.includes(w) || w.includes(b)) winner = "b";

      // Vencedor não bateu com nenhum dos lados → manda para revisão manual.
      if (!winner) {
        return { is_final: false, winner: null, confidence: 0, source_url: null };
      }
      return {
        is_final: true,
        winner,
        confidence: 0.95,
        source_url: `https://www.pandascore.co/matches/${event.external_id}`,
      };
    } catch {
      return { is_final: false, winner: null, confidence: 0, source_url: null };
    }
  },
};

/** Seleciona o provedor ativo a partir do ambiente. */
export function getResultsProvider(): ResultsProvider {
  if (process.env.PANDASCORE_TOKEN) return pandaScoreProvider;
  return manualProvider;
}

/** Valida o veredito do provedor. Veredito frouxo → tratado como não-final. */
export function isTrustworthy(v: ResultVerdict): boolean {
  const parsed = resultVerdictSchema.safeParse(v);
  if (!parsed.success) return false;
  return (
    parsed.data.is_final &&
    parsed.data.winner !== null &&
    parsed.data.confidence >= MIN_CONFIDENCE &&
    !!parsed.data.source_url
  );
}
