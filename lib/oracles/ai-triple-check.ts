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

function parseCheckResult(raw: string): CheckResult {
  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Extrai JSON — tenta full string primeiro, depois regex
    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Tenta extrair objeto JSON do texto
      const m = clean.match(/\{[\s\S]*?\}/);
      if (!m) throw new Error("no json");
      parsed = JSON.parse(m[0]);
    }
    const resultado = ["SIM", "NAO", "INCERTO"].includes(parsed.resultado) ? parsed.resultado : "INCERTO";
    return {
      resultado,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : (resultado !== "INCERTO" ? 90 : 0),
      fonte: typeof parsed.fonte === "string" ? parsed.fonte : "",
    };
  } catch {
    // Tenta ler SIM/NAO direto do texto como fallback
    const upper = raw.toUpperCase();
    if (upper.includes('"resultado":"SIM"') || upper.includes('"resultado": "SIM"')) return { resultado: "SIM", confianca: 90, fonte: "" };
    if (upper.includes('"resultado":"NAO"') || upper.includes('"resultado": "NAO"')) return { resultado: "NAO", confianca: 90, fonte: "" };
    return { resultado: "INCERTO", confianca: 0, fonte: "" };
  }
}

function buildPrompt(question: string, closesAt: string, tentativa: number): string {
  const agora = new Date().toISOString();
  const prazo = new Date(closesAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `Você é o oracle do site brasileiro de prediction markets Zafe.
Data atual: ${agora}
Prazo do mercado: ${prazo} (horário de Brasília)

Determine o resultado deste evento usando seu conhecimento e/ou busca na web:
"${question}"

Responda SOMENTE com JSON puro (sem markdown, sem texto extra, sem explicação):
{"resultado":"SIM","confianca":95,"fonte":"https://..."}

Regras IMPORTANTES:
- "resultado": "SIM" (aconteceu antes do prazo), "NAO" (não aconteceu no período), ou "INCERTO"
- Use SIM ou NAO se tiver certeza (confianca >= 80)
- Se o evento claramente NÃO aconteceu no período indicado → NAO
- Se o evento claramente aconteceu antes do prazo → SIM
- Só use INCERTO se realmente não tiver nenhuma informação${tentativa > 1 ? "\n- SEGUNDA TENTATIVA: seja mais assertivo com as evidências que encontrar" : ""}`;
}

// Tentativa COM web search (usando extra_headers)
async function verificacaoComSearch(question: string, closesAt: string, tentativa: number): Promise<CheckResult> {
  try {
    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
        messages: [{ role: "user", content: buildPrompt(question, closesAt, tentativa) }],
      },
      {
        headers: { "anthropic-beta": "web-search-2025-03-05" },
      }
    );
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "");
  } catch (e) {
    console.warn("[oracle] web_search falhou:", String(e));
    return { resultado: "INCERTO", confianca: 0, fonte: "search_error" };
  }
}

// Fallback SEM web search — Claude usa conhecimento de treinamento
async function verificacaoSemSearch(question: string, closesAt: string): Promise<CheckResult> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: buildPrompt(question, closesAt, 2) }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "");
  } catch (e) {
    console.warn("[oracle] fallback sem search falhou:", String(e));
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
  // Tentativa 1: SEM web search (rápido ~5s, Claude usa conhecimento de treinamento)
  const check1 = await verificacaoSemSearch(question, closesAt);

  if (check1.resultado !== "INCERTO") {
    return { resultado: check1.resultado, confianca: "alta", check1, check2: { resultado: "INCERTO", confianca: 0, fonte: "" }, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
  }

  // Tentativa 2: COM web search (mais lento, pode timeout em Vercel Hobby)
  const check2 = await verificacaoComSearch(question, closesAt, 2);

  if (check2.resultado !== "INCERTO") {
    return { resultado: check2.resultado, confianca: "alta", check1, check2, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
  }

  return { resultado: "INCERTO", confianca: "baixa", check1, check2, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
}

// Validação cruzada — confirma resultado já obtido por API fixa
export async function validacaoAI(question: string, resultadoDeclarado: string): Promise<boolean> {
  try {
    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
        messages: [{
          role: "user",
          content: `Confirme este resultado com busca na web.
Evento: "${question}"
Resultado declarado: ${resultadoDeclarado}
Responda APENAS JSON: {"confirmado":true,"fonte":"url"}`,
        }],
      },
      { headers: { "anthropic-beta": "web-search-2025-03-05" } }
    );
    const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    return parseCheckResult(textBlock?.text ?? "").resultado !== "INCERTO";
  } catch {
    return true;
  }
}
