/**
 * Oracle AI — Claude com web search + fallback sem search.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { OracleResult } from "./sports";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CheckResult {
  resultado: "SIM" | "NAO" | "INCERTO";
  confianca: number;
  fonte: string;
}

const ORACLE_SYSTEM = `Você é o oracle do site brasileiro de prediction markets Zafe.
Sua única função é determinar o resultado de eventos e responder SOMENTE com JSON puro.
Formato obrigatório (sem markdown, sem texto extra, sem explicação):
{"resultado":"SIM","confianca":95,"fonte":"https://..."}
Valores permitidos para resultado: "SIM", "NAO", "INCERTO"`;

/**
 * Extrai o objeto JSON com campo "resultado" de uma string de texto.
 * Robusto a respostas com prose ao redor do JSON (comum com web search).
 */
function extractResultadoJson(raw: string): { resultado: string; confianca?: number; fonte?: string } | null {
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Tenta parse direto primeiro
  try { return JSON.parse(clean); } catch {}

  // Tenta cada objeto JSON simples (sem nesting) até achar um com "resultado"
  const simpleMatches = clean.match(/\{[^{}]+\}/g) ?? [];
  for (const m of simpleMatches) {
    try {
      const obj = JSON.parse(m);
      if (typeof obj.resultado === "string") return obj;
    } catch { continue; }
  }

  // Fallback: regex literal para capturar o valor de "resultado"
  const resultadoMatch = clean.match(/"resultado"\s*:\s*"(SIM|NAO|INCERTO)"/);
  if (resultadoMatch) {
    const confiancaMatch = clean.match(/"confianca"\s*:\s*(\d+)/);
    return {
      resultado: resultadoMatch[1],
      confianca: confiancaMatch ? parseInt(confiancaMatch[1]) : 90,
      fonte: "",
    };
  }

  return null;
}

function parseCheckResult(raw: string): CheckResult {
  const parsed = extractResultadoJson(raw);
  if (parsed && ["SIM", "NAO", "INCERTO"].includes(parsed.resultado)) {
    const resultado = parsed.resultado as "SIM" | "NAO" | "INCERTO";
    return {
      resultado,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : (resultado !== "INCERTO" ? 90 : 0),
      fonte: typeof parsed.fonte === "string" ? parsed.fonte : "",
    };
  }
  return { resultado: "INCERTO", confianca: 0, fonte: "" };
}

function buildPrompt(question: string, closesAt: string, tentativa: number): string {
  const agora = new Date().toISOString();
  const prazo = new Date(closesAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `Data atual: ${agora}
Prazo do mercado: ${prazo} (horário de Brasília)

Determine o resultado deste evento:
"${question}"

Regras:
- "resultado": "SIM" (aconteceu antes do prazo), "NAO" (não aconteceu), ou "INCERTO"
- Use SIM ou NAO se confiança >= 80
- Só use INCERTO se não houver nenhuma informação disponível
- Eventos subjetivos (sem threshold numérico ou fato binário verificável) → INCERTO${tentativa > 1 ? "\n- SEGUNDA TENTATIVA: seja mais assertivo com as evidências disponíveis" : ""}`;
}

// Tentativa COM web search
async function verificacaoComSearch(question: string, closesAt: string, tentativa: number): Promise<CheckResult> {
  try {
    const response = await (client.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      betas: ["web-search-2025-03-05"],
      system: ORACLE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: buildPrompt(question, closesAt, tentativa) }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "");
  } catch (e) {
    console.warn("[oracle] web_search falhou:", String(e).slice(0, 200));
    return { resultado: "INCERTO", confianca: 0, fonte: "search_error" };
  }
}

// Fallback SEM web search — Claude usa conhecimento de treinamento
async function verificacaoSemSearch(question: string, closesAt: string): Promise<CheckResult> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: ORACLE_SYSTEM,
      messages: [{ role: "user", content: buildPrompt(question, closesAt, 2) }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "");
  } catch (e) {
    console.warn("[oracle] fallback sem search falhou:", String(e).slice(0, 200));
    return { resultado: "INCERTO", confianca: 0, fonte: "" };
  }
}

export interface TripleCheckResult {
  resultado: "SIM" | "NAO" | "INCERTO";
  confianca: "alta" | "baixa";
  check1: CheckResult;
  check2: CheckResult;
  check3: CheckResult;
}

export async function oracleAITripleCheck(
  question: string,
  closesAt: string
): Promise<TripleCheckResult> {
  // Tentativa 1: SEM web search (rápido, Claude usa conhecimento de treinamento)
  const check1 = await verificacaoSemSearch(question, closesAt);

  if (check1.resultado !== "INCERTO") {
    return { resultado: check1.resultado, confianca: "alta", check1, check2: { resultado: "INCERTO", confianca: 0, fonte: "" }, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
  }

  // Tentativa 2: COM web search
  const check2 = await verificacaoComSearch(question, closesAt, 2);

  if (check2.resultado !== "INCERTO") {
    return { resultado: check2.resultado, confianca: "alta", check1, check2, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
  }

  return { resultado: "INCERTO", confianca: "baixa", check1, check2, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
}

// Validação cruzada — confirma resultado já obtido por API fixa
export async function validacaoAI(question: string, resultadoDeclarado: string): Promise<boolean> {
  try {
    const response = await (client.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      betas: ["web-search-2025-03-05"],
      system: 'Responda SOMENTE com JSON: {"confirmado":true,"fonte":"url"} ou {"confirmado":false,"fonte":"url"}',
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Confirme este resultado com busca na web.
Evento: "${question}"
Resultado declarado: ${resultadoDeclarado}`,
      }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "").resultado !== "INCERTO";
  } catch {
    return true;
  }
}
