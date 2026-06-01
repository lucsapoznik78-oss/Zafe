/**
 * Resolve mercados expirados via UMA única chamada ao Claude com web search.
 * Todos os setores pendentes vão num só prompt e voltam num array JSON —
 * sem lotes, sem chamada por evento. Rápido e barato.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pagarVencedores } from "@/lib/payout";
import { pagarConcursoBets } from "@/lib/concurso-payout";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

/** Máximo de setores por chamada. ~1 web search por evento; 12 cabe folgado nos 60s
 *  do plano Hobby e no contexto do modelo (cada busca infla os input tokens). */
const MAX_EVENTS = 12;
/** Após N tentativas sem sucesso (INCERTO/erro), para de tentar automaticamente */
const MAX_ATTEMPTS = 3;

const ORACLE_SYSTEM = `Você é o oracle do site brasileiro de prediction markets Zafe.
Determina o resultado de eventos usando busca na web e responde com um array JSON.
Cada item: {"i":<número do evento>,"resultado":"SIM"|"NAO"|"INCERTO"}.
Prefira SIM ou NAO a INCERTO sempre que houver qualquer evidência.`;

type TopicRow = { id: string; title: string; category: string; closes_at: string; status: string; oracle_retry_count: number | null; concurso_id: string | null };
type Verdict = { i: number; resultado: "SIM" | "NAO" | "INCERTO" };

/**
 * Extrai os vereditos de uma resposta que pode vir como array JSON puro
 * ou com prosa ao redor. Coleta cada objeto {"i":N,"resultado":"X"} válido.
 */
function extractVerdicts(text: string): Verdict[] {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Tenta o array direto primeiro
  try {
    const arr = JSON.parse(clean);
    if (Array.isArray(arr)) {
      const ok = arr.filter((o) => typeof o?.i === "number" && ["SIM", "NAO", "INCERTO"].includes(o?.resultado));
      if (ok.length) return ok;
    }
  } catch {}

  // Tenta um array embutido na prosa
  const arrMatch = clean.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr)) {
        const ok = arr.filter((o) => typeof o?.i === "number" && ["SIM", "NAO", "INCERTO"].includes(o?.resultado));
        if (ok.length) return ok;
      }
    } catch {}
  }

  // Fallback: coleta cada objeto simples válido espalhado no texto
  const objs = clean.match(/\{[^{}]+\}/g) ?? [];
  const out: Verdict[] = [];
  for (const m of objs) {
    try {
      const o = JSON.parse(m);
      if (typeof o.i === "number" && ["SIM", "NAO", "INCERTO"].includes(o.resultado)) {
        out.push({ i: o.i, resultado: o.resultado });
      }
    } catch { continue; }
  }
  return out;
}

/** Manda todos os setores numa só chamada e devolve os vereditos por índice. */
async function consultarClaude(topics: TopicRow[]): Promise<Map<number, "SIM" | "NAO" | "INCERTO">> {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const lista = topics
    .map((t, idx) => {
      const prazo = new Date(t.closes_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return `${idx + 1}. "${t.title}" (prazo: ${prazo})`;
    })
    .join("\n");

  const prompt = `Data atual: ${agora} (horário de Brasília).
Use busca na web para determinar o resultado de CADA evento abaixo (se aconteceu antes do prazo):

${lista}

Responda SOMENTE com um array JSON, um objeto por evento:
[{"i":1,"resultado":"SIM"},{"i":2,"resultado":"NAO"}]
Valores permitidos: "SIM", "NAO" ou "INCERTO". Prefira SIM/NAO a INCERTO sempre que houver evidência.`;

  let verdicts: Verdict[] = [];
  try {
    const res = await (claude.beta.messages.create as any)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      betas: ["web-search-2025-03-05"],
      system: ORACLE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_EVENTS }],
      messages: [{ role: "user", content: prompt }],
    });
    const prose = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    verdicts = extractVerdicts(prose);

    // Com web search o modelo às vezes responde só em prosa (sem o array).
    // 2º passo barato (sem busca) converte a análise no array JSON.
    if (verdicts.length === 0 && prose.trim()) {
      const r2 = await claude.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: 'Converta a análise num array JSON: [{"i":1,"resultado":"SIM"}], valores "SIM"|"NAO"|"INCERTO".',
        messages: [
          { role: "user", content: `Eventos:\n${lista}\n\nAnálise:\n${prose}\n\nMonte o array JSON com o resultado de cada evento.` },
          { role: "assistant", content: "[" },
        ],
      });
      const t2 = r2.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      verdicts = extractVerdicts("[" + t2);
    }
  } catch (e) {
    console.error("[resolver-direto] consulta falhou:", String(e).slice(0, 200));
  }

  const map = new Map<number, "SIM" | "NAO" | "INCERTO">();
  for (const v of verdicts) map.set(v.i, v.resultado);
  return map;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Move qualquer active expirado para resolving
  await admin.from("topics")
    .update({ status: "resolving", oracle_retry_count: 0, oracle_next_retry_at: null })
    .eq("status", "active").eq("is_private", false).lt("closes_at", now);

  // Pega os setores pendentes (menos tentados primeiro), ignorando os que esgotaram tentativas
  const { data: topics } = await admin
    .from("topics")
    .select("id, title, category, closes_at, status, oracle_retry_count, concurso_id")
    .eq("status", "resolving").eq("is_private", false)
    .lt("oracle_retry_count", MAX_ATTEMPTS)
    .order("oracle_retry_count", { ascending: true })
    .order("closes_at", { ascending: true })
    .limit(MAX_EVENTS);

  if (!topics || topics.length === 0) {
    return NextResponse.json({ message: "Nenhum setor pendente", resolved: 0, incerto: 0, processed: 0, remaining: 0, done: true, results: [] });
  }

  // UMA chamada resolve todos
  const veredictos = await consultarClaude(topics as TopicRow[]);

  const results: { title: string; outcome: string }[] = [];
  for (let idx = 0; idx < topics.length; idx++) {
    const topic = topics[idx] as TopicRow;
    const resultado = veredictos.get(idx + 1);

    // Tópicos de concurso pagam de concurso_bets; os demais, de bets.
    const betsTable = topic.concurso_id ? "concurso_bets" : "bets";
    const { count: matched } = await admin
      .from(betsTable)
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topic.id).eq("status", "matched");
    const semBets = (matched ?? 0) === 0;

    if (resultado === "SIM" || resultado === "NAO") {
      try {
        const resolucao = resultado.toLowerCase() as "sim" | "nao";
        await admin.from("resolucoes").insert({
          mercado_id: topic.id,
          resolvido_por: "oracle_ai_direto",
          oracle_usado: "claude-haiku-4-5-20251001",
          numero_tentativa: (topic.oracle_retry_count ?? 0) + 1,
          resultado_final: resultado,
        });
        if (topic.concurso_id) await pagarConcursoBets(admin, topic.id, resolucao);
        else await pagarVencedores(admin, topic.id, resolucao, user.id);
        // Sem palpites nenhum payout marca o tópico — fecha manualmente
        if (semBets) {
          await admin.from("topics").update({ status: "resolved", resolution: resolucao, resolved_at: new Date().toISOString() }).eq("id", topic.id);
        }
        results.push({ title: topic.title, outcome: resultado });
      } catch (err) {
        await admin.from("topics").update({ oracle_retry_count: (topic.oracle_retry_count ?? 0) + 1 }).eq("id", topic.id);
        results.push({ title: topic.title, outcome: `erro: ${String(err).slice(0, 100)}` });
      }
    } else if (semBets) {
      // INCERTO sem palpites: ninguém afetado, encerra como anulado para sair da fila
      await admin.from("topics").update({ status: "resolved", resolution: null, resolved_at: new Date().toISOString() }).eq("id", topic.id);
      results.push({ title: topic.title, outcome: "anulado" });
    } else {
      // INCERTO com palpites → conta tentativa
      await admin.from("topics").update({ oracle_retry_count: (topic.oracle_retry_count ?? 0) + 1 }).eq("id", topic.id);
      results.push({ title: topic.title, outcome: "incerto" });
    }
  }

  // Quantos ainda restam (excluindo os que esgotaram tentativas)
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
