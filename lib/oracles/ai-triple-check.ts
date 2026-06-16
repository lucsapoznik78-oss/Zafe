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

function parseCheckResult(raw: string, outcomes?: string[]): CheckResult {
  const parsed = extractResultadoJson(raw);
  const validValues = outcomes && outcomes.length > 0
    ? [...outcomes, "INCERTO"]
    : ["SIM", "NAO", "INCERTO"];
  if (parsed && validValues.includes(parsed.resultado)) {
    const resultado = parsed.resultado as "SIM" | "NAO" | "INCERTO";
    return {
      resultado,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : (resultado !== "INCERTO" ? 90 : 0),
      fonte: typeof parsed.fonte === "string" ? parsed.fonte : "",
    };
  }
  return { resultado: "INCERTO", confianca: 0, fonte: "" };
}

function buildPrompt(question: string, closesAt: string, tentativa: number, outcomes?: string[]): string {
  const agora = new Date().toISOString();
  const prazo = new Date(closesAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  if (outcomes && outcomes.length > 0) {
    const opcoesStr = outcomes.map((o) => `"${o}"`).join(", ");
    return `Data atual: ${agora}
Prazo do mercado: ${prazo} (horário de Brasília)

Determine qual dos seguintes resultados ocorreu antes do prazo para este evento:
"${question}"

Opções disponíveis: [${opcoesStr}]

Responda SOMENTE com JSON puro (sem markdown):
{"resultado":"<label exato de uma das opções>","confianca":95,"fonte":"https://..."}
ou se incerto:
{"resultado":"INCERTO","confianca":0,"fonte":""}

IMPORTANTE: "resultado" deve ser EXATAMENTE um dos labels da lista ou "INCERTO".${tentativa > 1 ? "\n- SEGUNDA TENTATIVA: seja mais assertivo." : ""}`;
  }

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
async function verificacaoComSearch(question: string, closesAt: string, tentativa: number, outcomes?: string[]): Promise<CheckResult> {
  try {
    const response = await (client.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      betas: ["web-search-2025-03-05"],
      system: ORACLE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: buildPrompt(question, closesAt, tentativa, outcomes) }],
    });
    const allText = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");

    // Às vezes já vem JSON direto.
    const direto = parseCheckResult(allText, outcomes);
    if (direto.resultado !== "INCERTO") return direto;

    // Mas com web search o modelo quase sempre responde em PROSA (raciocínio, sem JSON),
    // o que dava sempre INCERTO. 2º passo barato extrai o veredito da própria análise.
    if (allText.trim()) {
      const valores = outcomes && outcomes.length > 0
        ? outcomes.map((o) => `"${o}"`).join(", ") + ' ou "INCERTO"'
        : '"SIM", "NAO" ou "INCERTO"';
      const r2 = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        system: `Com base na análise fornecida, responda SOMENTE com JSON no formato {"resultado":X} onde X é um de: ${valores}`,
        messages: [
          { role: "user", content: `Evento: "${question}"\n\nAnálise:\n${allText}\n\nQual o resultado?` },
          { role: "assistant", content: '{"resultado":"' },
        ],
      });
      const t2 = r2.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      return parseCheckResult('{"resultado":"' + t2, outcomes);
    }
    return direto;
  } catch (e) {
    console.warn("[oracle] web_search falhou:", String(e).slice(0, 200));
    return { resultado: "INCERTO", confianca: 0, fonte: "search_error" };
  }
}

// Fallback SEM web search — Claude usa conhecimento de treinamento
async function verificacaoSemSearch(question: string, closesAt: string, outcomes?: string[]): Promise<CheckResult> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: ORACLE_SYSTEM,
      messages: [{ role: "user", content: buildPrompt(question, closesAt, 2, outcomes) }],
    });
    const allText = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    return parseCheckResult(allText, outcomes);
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

// Camada 2 exige DUAS verificações independentes que CONCORDAM, cada uma com
// confiança >= 85% (CLAUDE.md / spec do oracle). Pagar com base numa fonte só
// — como fazia antes (G9) — pode liquidar um mercado com prêmio com base num
// único palpite do modelo, sem o cross-check exigido.
const CONFIDENCE_THRESHOLD = 85;

function agreeHigh(a: CheckResult, b: CheckResult): boolean {
  return (
    a.resultado !== "INCERTO" &&
    a.resultado === b.resultado &&
    a.confianca >= CONFIDENCE_THRESHOLD &&
    b.confianca >= CONFIDENCE_THRESHOLD
  );
}

export async function oracleAITripleCheck(
  question: string,
  closesAt: string,
  outcomes?: string[]
): Promise<TripleCheckResult> {
  // Check1 + Check2: duas buscas independentes com web search.
  const check1 = await verificacaoComSearch(question, closesAt, 1, outcomes);
  const check2 = await verificacaoComSearch(question, closesAt, 2, outcomes);

  // Resolve só se as duas buscas concordam, ambas com confiança >= 85% (G9).
  if (agreeHigh(check1, check2)) {
    return { resultado: check1.resultado, confianca: "alta", check1, check2, check3: { resultado: "INCERTO", confianca: 0, fonte: "" } };
  }

  // Desempate: terceira verificação (sem search, conhecimento de treinamento).
  // Só resolve se concordar com uma das buscas, ambas >= 85% — mantém o
  // requisito de DUAS fontes independentes concordantes.
  const check3 = await verificacaoSemSearch(question, closesAt, outcomes);
  if (agreeHigh(check1, check3)) {
    return { resultado: check1.resultado, confianca: "alta", check1, check2, check3 };
  }
  if (agreeHigh(check2, check3)) {
    return { resultado: check2.resultado, confianca: "alta", check1, check2, check3 };
  }

  return { resultado: "INCERTO", confianca: "baixa", check1, check2, check3 };
}

// Validação cruzada — confirma resultado já obtido por API fixa
export async function validacaoAI(question: string, resultadoDeclarado: string): Promise<boolean> {
  try {
    const response = await (client.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      betas: ["web-search-2025-03-05"],
      system: 'Responda SOMENTE com JSON: {"confirmado":true,"fonte":"url"} ou {"confirmado":false,"fonte":"url"}',
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{
        role: "user",
        content: `Confirme este resultado com busca na web.
Evento: "${question}"
Resultado declarado: ${resultadoDeclarado}`,
      }],
    });
    const allText = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    return parseCheckResult(allText).resultado !== "INCERTO";
  } catch {
    return true;
  }
}
