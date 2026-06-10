/**
 * Zafe Copa — oráculo de resultados via Claude API com web search.
 *
 * A Claude NÃO sabe placares sozinha (training cutoff): ela DEVE buscar
 * na web e citar a fonte. Anti-alucinação:
 *  * resposta SOMENTE em JSON estrito, validado por zod
 *  * source_url obrigatório — sem fonte, não resolve
 *  * DOUBLE-CHECK: duas chamadas independentes; só aplica se as duas
 *    concordarem em placar/classificado/is_final com confidence >= 0.85
 *  * qualquer divergência/baixa confiança/JSON malformado → revisão
 *    manual (NUNCA pontua automaticamente)
 *
 * O oráculo só adjudica o RESULTADO; os pontos são 100% da engine
 * determinística (lib/copa/scoring.ts).
 */

import Anthropic from "@anthropic-ai/sdk";
import { CopaMatch, CopaSide, OracleVerdict, oracleVerdictSchema, isKnockout } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
export const MIN_CONFIDENCE = 0.85;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface OracleCheck {
  raw: string;
  verdict: OracleVerdict | null;
  parseError: string | null;
}

export type OracleOutcome =
  | { kind: "verdict"; verdict: OracleVerdict; advancedSide: CopaSide | null; checks: OracleCheck[] }
  | { kind: "not_final"; checks: OracleCheck[] }
  | { kind: "review"; reason: string; checks: OracleCheck[] };

const ORACLE_SYSTEM = `Você é o oráculo de resultados da Copa do Mundo 2026 do site brasileiro Zafe.
Sua única função é verificar o resultado OFICIAL de uma partida buscando na web e responder SOMENTE com JSON puro (sem markdown, sem texto extra).

Formato obrigatório:
{"is_final":true,"home_goals":2,"away_goals":1,"went_to_et":false,"went_to_pens":false,"winner_team":"Brasil","advanced_team":"Brasil","confidence":0.95,"source_url":"https://..."}

Regras CRÍTICAS:
- home_goals/away_goals = placar ao FIM DO JOGO incluindo prorrogação, EXCLUINDO disputa de pênaltis. Ex.: 1-1 na prorrogação decidido 5-4 nos pênaltis → home_goals:1, away_goals:1, went_to_pens:true.
- winner_team/advanced_team: use EXATAMENTE o nome do time como aparece na pergunta. Em empate na fase de grupos, winner_team e advanced_team são null. No mata-mata, advanced_team = quem se classificou (inclui pênaltis).
- is_final: true SOMENTE se a partida terminou e o resultado é oficial. Se ainda não terminou/não começou: {"is_final":false,"home_goals":0,"away_goals":0,"went_to_et":false,"went_to_pens":false,"winner_team":null,"advanced_team":null,"confidence":1,"source_url":"https://..."}
- source_url: OBRIGATÓRIO, a URL da fonte que você consultou. Sem fonte confiável → confidence baixa.
- confidence: 0 a 1. Use >= 0.9 só com fonte oficial/confiável clara.
- VOCÊ NÃO SABE O RESULTADO DE MEMÓRIA. Busque na web SEMPRE.`;

/**
 * Extrai e valida o JSON do veredito de uma resposta crua.
 * Pura (testável): robusta a markdown fences e prosa ao redor.
 */
export function parseOracleResponse(raw: string): { verdict: OracleVerdict | null; error: string | null } {
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const candidates: string[] = [clean];
  // objetos JSON não aninhados no meio de prosa
  for (const m of clean.match(/\{[^{}]+\}/g) ?? []) candidates.push(m);

  for (const c of candidates) {
    let obj: unknown;
    try {
      obj = JSON.parse(c);
    } catch {
      continue;
    }
    const parsed = oracleVerdictSchema.safeParse(obj);
    if (parsed.success) return { verdict: parsed.data, error: null };
    // achou JSON com cara de veredito mas inválido → reporta o motivo
    if (typeof obj === "object" && obj !== null && "is_final" in obj) {
      return { verdict: null, error: parsed.error.issues[0]?.message ?? "JSON inválido" };
    }
  }
  return { verdict: null, error: "Nenhum JSON de veredito na resposta" };
}

function normalizeTeam(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Mapeia o nome de time retornado pelo oráculo para 'home' | 'away'. */
export function teamToSide(
  team: string | null,
  match: Pick<CopaMatch, "home_team" | "away_team">
): CopaSide | null {
  if (!team || !match.home_team || !match.away_team) return null;
  const t = normalizeTeam(team);
  if (t === normalizeTeam(match.home_team)) return "home";
  if (t === normalizeTeam(match.away_team)) return "away";
  return null;
}

function buildPrompt(match: CopaMatch, attempt: number): string {
  const kickoff = new Date(match.kickoff_at).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const fase = match.stage === "group" ? `fase de grupos (grupo ${match.group_name})` : "mata-mata";
  return `Data atual: ${new Date().toISOString()}

Verifique na web o resultado oficial desta partida da Copa do Mundo FIFA 2026 (${fase}):

${match.home_team} x ${match.away_team}
Início: ${kickoff} (horário de Brasília) — jogo nº ${match.match_number} da Copa 2026

Responda SOMENTE com o JSON no formato especificado. winner_team/advanced_team devem ser EXATAMENTE "${match.home_team}" ou "${match.away_team}" (ou null em caso de empate na fase de grupos).${attempt > 1 ? "\nVERIFICAÇÃO INDEPENDENTE: confira em uma fonte diferente da óbvia, se possível." : ""}`;
}

async function runCheck(match: CopaMatch, attempt: number): Promise<OracleCheck> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.beta.messages.create as any)({
      model: MODEL,
      max_tokens: 1024,
      betas: ["web-search-2025-03-05"],
      system: ORACLE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      messages: [{ role: "user", content: buildPrompt(match, attempt) }],
    });
    const raw = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("\n");
    const { verdict, error } = parseOracleResponse(raw);
    return { raw, verdict, parseError: error };
  } catch (e) {
    return { raw: `API_ERROR: ${String(e).slice(0, 500)}`, verdict: null, parseError: "api_error" };
  }
}

/**
 * Compara os dois vereditos e valida a consistência do resultado com a
 * fase da partida. Pura (testável).
 */
export function adjudicate(
  match: Pick<CopaMatch, "stage" | "home_team" | "away_team">,
  checks: OracleCheck[]
): OracleOutcome {
  const [c1, c2] = checks;

  if (!c1.verdict || !c2.verdict) {
    const reason = c1.parseError === "api_error" || c2.parseError === "api_error"
      ? "api_error"
      : "parse_error";
    return { kind: "review", reason, checks };
  }
  const v1 = c1.verdict;
  const v2 = c2.verdict;

  if (!v1.is_final || !v2.is_final) {
    // os dois concordam que não terminou → tenta de novo depois
    if (!v1.is_final && !v2.is_final) return { kind: "not_final", checks };
    return { kind: "review", reason: "disagreement", checks };
  }

  if (
    v1.home_goals !== v2.home_goals ||
    v1.away_goals !== v2.away_goals ||
    v1.went_to_pens !== v2.went_to_pens
  ) {
    return { kind: "review", reason: "disagreement", checks };
  }

  if (v1.confidence < MIN_CONFIDENCE || v2.confidence < MIN_CONFIDENCE) {
    return { kind: "review", reason: "manual_review", checks };
  }

  const knockout = isKnockout(match.stage);
  const side1 = teamToSide(v1.advanced_team, match);
  const side2 = teamToSide(v2.advanced_team, match);

  if (knockout) {
    // classificado é obrigatório e os dois checks devem concordar
    if (!side1 || side1 !== side2) {
      return { kind: "review", reason: side1 && side2 ? "disagreement" : "parse_error", checks };
    }
    // consistência: sem pênaltis, o classificado tem que bater com o placar
    if (!v1.went_to_pens) {
      if (v1.home_goals === v1.away_goals) {
        return { kind: "review", reason: "manual_review", checks }; // empate sem pênaltis no mata-mata?
      }
      const byScore: CopaSide = v1.home_goals > v1.away_goals ? "home" : "away";
      if (byScore !== side1) return { kind: "review", reason: "disagreement", checks };
    }
  } else {
    // fase de grupos não tem prorrogação/pênaltis
    if (v1.went_to_et || v1.went_to_pens) {
      return { kind: "review", reason: "manual_review", checks };
    }
  }

  return { kind: "verdict", verdict: v1, advancedSide: knockout ? side1 : null, checks };
}

/** Duas chamadas independentes + adjudicação. */
export async function fetchMatchResult(match: CopaMatch): Promise<OracleOutcome> {
  const c1 = await runCheck(match, 1);
  const c2 = await runCheck(match, 2);
  return adjudicate(match, [c1, c2]);
}
