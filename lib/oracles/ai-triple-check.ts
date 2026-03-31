/**
 * Oracle AI Triple-Check
 * Roda 3 chamadas Claude independentes em paralelo com web search.
 * Exige 2/3 concordando em SIM ou NAO para resolver.
 * Caso contrário retorna INCERTO.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { OracleResult } from "./sports";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface CheckResult {
  resultado: "SIM" | "NAO" | "INCERTO";
  confianca: number;
  fonte: string;
}

async function umaVerificacao(question: string, closesAt: string): Promise<CheckResult> {
  const prompt = `Você é um oracle de resolução de mercados para um site brasileiro de apostas chamado Zafe.
Pesquise na internet agora e determine o resultado deste mercado.

Responda APENAS com JSON puro, sem texto extra, sem markdown, sem \`\`\`:
{ "resultado": "SIM" | "NAO" | "INCERTO", "confianca": 0-100, "fonte": "url_exata" }

Regras:
- Só responda SIM ou NAO se a confiança for acima de 90
- Se o resultado do evento ainda não foi confirmado publicamente, responda INCERTO
- Se encontrar fontes contraditórias, responda INCERTO
- fonte deve ser a URL exata onde encontrou o resultado
- O prazo deste mercado era: ${closesAt}
- Data atual: ${new Date().toISOString()}

Pergunta do mercado: "${question}"`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 300,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      messages: [{ role: "user", content: prompt }],
    });

    // Extrair texto da resposta
    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const raw = textBlock?.text?.trim() ?? "";

    // Limpa markdown se houver
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      resultado: ["SIM", "NAO", "INCERTO"].includes(parsed.resultado) ? parsed.resultado : "INCERTO",
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0,
      fonte: typeof parsed.fonte === "string" ? parsed.fonte : "",
    };
  } catch {
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
  const [check1, check2, check3] = await Promise.all([
    umaVerificacao(question, closesAt),
    umaVerificacao(question, closesAt),
    umaVerificacao(question, closesAt),
  ]);

  const resultados = [check1.resultado, check2.resultado, check3.resultado];
  const simCount = resultados.filter((r) => r === "SIM").length;
  const naoCount = resultados.filter((r) => r === "NAO").length;

  if (simCount >= 2) return { resultado: "SIM", confianca: "alta", check1, check2, check3 };
  if (naoCount >= 2) return { resultado: "NAO", confianca: "alta", check1, check2, check3 };
  return { resultado: "INCERTO", confianca: "baixa", check1, check2, check3 };
}

// Validação cruzada — UMA chamada só para confirmar resultado já obtido por API fixa
export async function validacaoAI(question: string, resultadoDeclarado: string): Promise<boolean> {
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 150,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      messages: [{
        role: "user",
        content: `Confirme este resultado com uma busca na web.
Evento: "${question}"
Resultado declarado: ${resultadoDeclarado}
Responda APENAS: { "confirmado": true | false, "fonte": "url" }`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
    const raw = textBlock?.text?.trim() ?? "";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return parsed.confirmado === true;
  } catch {
    return true; // em caso de erro na validação, não bloquear o pagamento
  }
}
