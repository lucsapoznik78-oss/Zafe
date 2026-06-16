/**
 * Insights Premium por evento.
 *
 * Gera, via Claude + web search, um resumo informativo de cada evento
 * (pesquisas, dados históricos e contexto geral) e cacheia em `topic_insights`.
 * Conteúdo é perk exclusivo Premium — o gate de leitura fica na API.
 *
 * Compliance: conteúdo informativo e neutro. NUNCA recomendar "aposta/palpite",
 * nunca sugerir resultado — apenas contexto factual para o previsor decidir.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { TopicInsightContent } from "@/types/database";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5-20251001";

// Eventos ativos: regenera se o cache estiver mais velho que isto.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface TopicLike {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  closes_at?: string | null;
}

const RESEARCH_SYSTEM = `Você é analista de contexto do Zafe, a liga de previsões do Brasil.
Sua função é dar ao previsor INFORMAÇÃO factual e neutra sobre um evento para ele formar a própria opinião.
Regras de linguagem (obrigatórias):
- NUNCA recomende uma "aposta", "palpite" ou um lado a escolher.
- NUNCA afirme qual será o resultado. Apresente dados, não previsões suas.
- Português do Brasil, tom jornalístico e imparcial.
- Use a busca na web para trazer dados atuais (pesquisas, números, fatos recentes) e cite as fontes (URLs).`;

const STRUCTURE_SYSTEM = `Converta a análise fornecida em JSON puro (sem markdown, sem texto extra) no formato EXATO:
{"resumo":"...","pontos_chave":["...","..."],"pesquisas":"...","historico":"...","contexto":"...","fontes":["https://...","https://..."]}
Regras:
- "resumo": 1-2 frases neutras sobre o evento.
- "pontos_chave": 3 a 5 itens objetivos.
- "pesquisas": dados/estatísticas/números relevantes (ou "" se não houver).
- "historico": antecedentes e precedentes relevantes (ou "").
- "contexto": panorama geral atual (ou "").
- "fontes": URLs citadas na análise (pode ser []).
- Tudo em português do Brasil, neutro, sem recomendar resultado.`;

function buildResearchPrompt(topic: TopicLike): string {
  const prazo = topic.closes_at
    ? new Date(topic.closes_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "não informado";
  return `Evento: "${topic.title}"
${topic.description ? `Descrição: ${topic.description}\n` : ""}Categoria: ${topic.category ?? "geral"}
Prazo do evento: ${prazo}

Pesquise e escreva uma análise de contexto cobrindo: um resumo do evento, os pontos-chave,
dados de pesquisas/estatísticas relevantes, o histórico/antecedentes e o contexto geral atual.
Cite as fontes (URLs). Não diga qual será o resultado — só forneça a informação.`;
}

function extractJson(raw: string): TopicInsightContent | null {
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const obj = JSON.parse(clean);
    if (typeof obj.resumo === "string") return normalize(obj);
  } catch {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (typeof obj.resumo === "string") return normalize(obj);
    } catch {}
  }
  return null;
}

function normalize(obj: any): TopicInsightContent {
  return {
    resumo: typeof obj.resumo === "string" ? obj.resumo : "",
    pontos_chave: Array.isArray(obj.pontos_chave) ? obj.pontos_chave.filter((x: any) => typeof x === "string") : [],
    pesquisas: typeof obj.pesquisas === "string" ? obj.pesquisas : "",
    historico: typeof obj.historico === "string" ? obj.historico : "",
    contexto: typeof obj.contexto === "string" ? obj.contexto : "",
    fontes: Array.isArray(obj.fontes) ? obj.fontes.filter((x: any) => typeof x === "string") : [],
  };
}

export async function generateTopicInsights(topic: TopicLike): Promise<TopicInsightContent | null> {
  // 1) Pesquisa com web search — quase sempre responde em prosa.
  const research = await (client.beta.messages.create as any)({
    model: MODEL,
    max_tokens: 1500,
    betas: ["web-search-2025-03-05"],
    system: RESEARCH_SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [{ role: "user", content: buildResearchPrompt(topic) }],
  });
  const analysis = research.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  if (!analysis) return null;

  // 2) Estrutura a análise em JSON.
  const structured = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: STRUCTURE_SYSTEM,
    messages: [{ role: "user", content: `Evento: "${topic.title}"\n\nAnálise:\n${analysis}` }],
  });
  const text = structured.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  return extractJson(text);
}

/**
 * Lê SOMENTE o cache de `topic_insights` (nunca gera). Usado para chamadas
 * free/anon — gerar custa 2 chamadas Claude pagas, então o gerador só roda
 * para premium autenticado (audit G6: cost-amplification DoS). Requer
 * service_role (createAdminClient) pois a tabela tem RLS sem policy de SELECT.
 */
export async function readCachedInsights(
  admin: any,
  topicId: string
): Promise<TopicInsightContent | null> {
  const { data: cached } = await admin
    .from("topic_insights")
    .select("content, status")
    .eq("topic_id", topicId)
    .maybeSingle();
  if (cached?.status === "ok" && cached.content) {
    return cached.content as TopicInsightContent;
  }
  return null;
}

/**
 * Lê o cache de `topic_insights`; gera (e faz upsert) se não existir ou estiver
 * velho. Requer um client com service_role (createAdminClient).
 */
export async function getOrGenerateInsights(
  admin: any,
  topic: TopicLike
): Promise<TopicInsightContent | null> {
  const { data: cached } = await admin
    .from("topic_insights")
    .select("content, generated_at, status")
    .eq("topic_id", topic.id)
    .maybeSingle();

  if (cached?.status === "ok" && cached.content) {
    const age = Date.now() - new Date(cached.generated_at).getTime();
    if (age < MAX_AGE_MS) return cached.content as TopicInsightContent;
  }

  const content = await generateTopicInsights(topic);
  if (!content) {
    // Se já havia cache válido, devolve o antigo em vez de nada.
    return (cached?.content as TopicInsightContent) ?? null;
  }

  await admin.from("topic_insights").upsert({
    topic_id: topic.id,
    content,
    model: MODEL,
    status: "ok",
    generated_at: new Date().toISOString(),
  });

  return content;
}
