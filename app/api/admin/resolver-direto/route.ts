/**
 * Resolve mercados expirados diretamente via Claude com web search.
 * Usado quando o oracle automático falha por timeout ou INCERTO.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pagarVencedores, reembolsarTodos } from "@/lib/payout";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

/** Quantos setores resolver por chamada. 2 web searches em paralelo cabem nos 60s
 *  do plano Hobby; com 4 a função estourava o tempo e gastava a API sem salvar nada. */
const BATCH = 2;
/** Após N tentativas sem sucesso (INCERTO/erro), para de tentar automaticamente */
const MAX_ATTEMPTS = 3;

const ORACLE_SYSTEM = `Você é o oracle do site brasileiro de prediction markets Zafe.
Sua única função é determinar o resultado de eventos e responder SOMENTE com JSON puro.
Formato obrigatório (sem markdown, sem texto extra, sem explicação):
{"resultado":"SIM","confianca":95}
ou
{"resultado":"NAO","confianca":95}
ou
{"resultado":"INCERTO","confianca":0}
Valores permitidos para resultado: "SIM", "NAO", "INCERTO"`;

/**
 * Extrai o JSON com campo "resultado" de uma string possivelmente com prose ao redor.
 * Resolve o problema do regex greedy que captura múltiplos objetos JSON.
 */
function extractResultado(text: string): { resultado: string; confianca: number } | null {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Parse direto
  try { return JSON.parse(clean); } catch {}

  // Tenta cada objeto simples (sem nesting) até achar um com "resultado"
  const matches = clean.match(/\{[^{}]+\}/g) ?? [];
  for (const m of matches) {
    try {
      const obj = JSON.parse(m);
      if (["SIM", "NAO", "INCERTO"].includes(obj.resultado)) return obj;
    } catch { continue; }
  }

  // Fallback: regex literal para capturar o valor de "resultado"
  const rm = clean.match(/"resultado"\s*:\s*"(SIM|NAO|INCERTO)"/);
  if (rm) {
    const cm = clean.match(/"confianca"\s*:\s*(\d+)/);
    return { resultado: rm[1], confianca: cm ? parseInt(cm[1]) : 90 };
  }

  return null;
}

type TopicRow = { id: string; title: string; category: string; closes_at: string; status: string; oracle_retry_count: number | null };

/** Consulta o Claude (web search, com fallback) e devolve o resultado bruto. */
async function consultarClaude(topic: TopicRow): Promise<{ resultado: string; confianca: number } | null> {
  const prazo = new Date(topic.closes_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const prompt = `Data atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)
Prazo do mercado: ${prazo} (horário de Brasília)

Use busca na web para verificar se este evento aconteceu antes do prazo:
"${topic.title}"

IMPORTANTE: Prefira SIM ou NAO a INCERTO sempre que encontrar qualquer evidência.`;

  try {
    const betaRes = await (claude.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      betas: ["web-search-2025-03-05"],
      system: ORACLE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    });
    const prose = betaRes.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");

    // Às vezes o modelo já devolve o JSON direto.
    const direto = extractResultado(prose);
    if (direto) return direto;

    // Mas com web search ele quase sempre responde em PROSA (raciocínio, sem JSON).
    // 2º passo barato (sem busca, ~40 tokens) extrai o veredito da própria análise.
    if (prose.trim()) {
      const r2 = await claude.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 40,
        system: 'Com base na análise fornecida, responda SOMENTE com JSON: {"resultado":"SIM"}, {"resultado":"NAO"} ou {"resultado":"INCERTO"}',
        messages: [
          { role: "user", content: `Evento: "${topic.title}"\n\nAnálise:\n${prose}\n\nQual o resultado?` },
          { role: "assistant", content: '{"resultado":"' },
        ],
      });
      const t2 = r2.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      return extractResultado('{"resultado":"' + t2);
    }
    return null;
  } catch {
    // Fallback sem web search — usa prefill para forçar saída JSON
    const fallbackRes = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: ORACLE_SYSTEM,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: '{"resultado":' },
      ],
    });
    const tb = fallbackRes.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return extractResultado('{"resultado":' + tb);
  }
}

/** Resolve um único setor. Devolve o desfecho para o relatório. */
async function resolverUm(admin: any, topic: TopicRow, userId: string): Promise<{ title: string; outcome: string }> {
  try {
    const parsed = await consultarClaude(topic);

    if (!parsed || !["SIM", "NAO", "INCERTO"].includes(parsed.resultado)) {
      console.error("[resolver-direto] parse falhou para:", topic.title, "| parsed:", JSON.stringify(parsed));
      await admin.from("topics")
        .update({ oracle_retry_count: (topic.oracle_retry_count ?? 0) + 1 })
        .eq("id", topic.id);
      return { title: topic.title, outcome: "parse_error" };
    }

    if (parsed.resultado === "INCERTO") {
      await admin.from("topics")
        .update({ oracle_retry_count: (topic.oracle_retry_count ?? 0) + 1 })
        .eq("id", topic.id);
      return { title: topic.title, outcome: "incerto" };
    }

    const resolucao = parsed.resultado.toLowerCase() as "sim" | "nao";
    await admin.from("resolucoes").insert({
      mercado_id: topic.id,
      resolvido_por: "oracle_ai_direto",
      oracle_usado: "claude-haiku-4-5-20251001",
      numero_tentativa: (topic.oracle_retry_count ?? 0) + 1,
      resultado_final: parsed.resultado,
    });

    await pagarVencedores(admin, topic.id, resolucao, userId);
    return { title: topic.title, outcome: parsed.resultado };
  } catch (err) {
    await admin.from("topics")
      .update({ oracle_retry_count: (topic.oracle_retry_count ?? 0) + 1 })
      .eq("id", topic.id);
    return { title: topic.title, outcome: `erro: ${String(err).slice(0, 100)}` };
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Move qualquer active expirado para resolving (retry_count 0 → entram na frente da fila)
  await admin.from("topics")
    .update({ status: "resolving", oracle_retry_count: 0, oracle_next_retry_at: null })
    .eq("status", "active").eq("is_private", false).lt("closes_at", now);

  // Pega só um lote desta vez, priorizando os que tiveram menos tentativas.
  // Setores que ficaram INCERTO/erro MAX_ATTEMPTS vezes são ignorados (resolva manual).
  const { data: batch } = await admin
    .from("topics")
    .select("id, title, category, closes_at, status, oracle_retry_count")
    .eq("status", "resolving").eq("is_private", false)
    .lt("oracle_retry_count", MAX_ATTEMPTS)
    .order("oracle_retry_count", { ascending: true })
    .order("closes_at", { ascending: true })
    .limit(BATCH);

  if (!batch || batch.length === 0) {
    return NextResponse.json({ message: "Nenhum setor pendente para resolver automaticamente", resolved: 0, incerto: 0, processed: 0, remaining: 0, done: true, results: [] });
  }

  // Resolve o lote em paralelo (cabe no limite de 60s)
  const results = await Promise.all(batch.map((t: TopicRow) => resolverUm(admin, t, user.id)));

  // Quantos ainda restam para próximas chamadas (excluindo os que esgotaram tentativas)
  const { count: remaining } = await admin
    .from("topics")
    .select("id", { count: "exact", head: true })
    .eq("status", "resolving").eq("is_private", false)
    .lt("oracle_retry_count", MAX_ATTEMPTS);

  return NextResponse.json({
    resolved: results.filter(r => r.outcome === "SIM" || r.outcome === "NAO").length,
    incerto: results.filter(r => r.outcome === "incerto").length,
    processed: results.length,
    remaining: remaining ?? 0,
    done: (remaining ?? 0) === 0,
    results,
  });
}
