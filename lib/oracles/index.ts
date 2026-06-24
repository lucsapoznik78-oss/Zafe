/**
 * Orquestrador oracle Zafe
 * Camada 1: API fixa por categoria (gratuita)
 * Camada 1b: Auto-detecção por categoria (ex: dólar → PTAX histórico)
 * Camada 2: Claude Haiku (barato)
 * Camada 3: Retry em 2h (máx 3 tentativas)
 * Camada 4: Reembolso automático
 */

import { oracleEsportes } from "./sports";
import { oracleAITripleCheck } from "./ai-triple-check";
import { pagarVencedores, pagarVencedoresMulti, reembolsarTodos } from "@/lib/payout";
import { pagarConcursoBets, pagarConcursoBetsMulti } from "@/lib/concurso-payout";
import type { OracleResult } from "./sports";

const RETRY_INTERVAL_MS = 2 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

interface Topic {
  id: string;
  title: string;
  category: string;
  oracle_api_id: string | null;
  oracle_retry_count: number;
  closes_at: string;
  market_type?: "binary" | "multi";
}

async function salvarResolucao(supabase: any, topic: Topic, opts: {
  resolvido_por: string; oracle_usado: string; numero_tentativa: number;
  resultado_final: string; apiResult?: OracleResult | null;
  aiResult?: Awaited<ReturnType<typeof oracleAITripleCheck>> | null;
}) {
  try {
    await supabase.from("resolucoes").insert({
      mercado_id: topic.id,
      resolvido_por: opts.resolvido_por,
      oracle_usado: opts.oracle_usado,
      numero_tentativa: opts.numero_tentativa,
      resultado_final: opts.resultado_final,
      check1_resultado: opts.aiResult?.check1.resultado ?? null,
      check1_fonte: opts.aiResult?.check1.fonte ?? null,
      check1_confianca: opts.aiResult?.check1.confianca ?? null,
      check2_resultado: opts.aiResult?.check2.resultado ?? null,
      check2_fonte: opts.aiResult?.check2.fonte ?? null,
      check2_confianca: opts.aiResult?.check2.confianca ?? null,
    });
  } catch (e) {
    console.error("[oracle] salvarResolucao error:", e);
  }
}

async function tentativaApiFixa(topic: Topic): Promise<OracleResult | null> {
  const id = topic.oracle_api_id ?? "";
  const q = topic.title;
  const cat = topic.category;
  try {
    // Esporte e e-sports usam a mesma API de resultados esportivos quando há
    // oracle_api_id; sem id, caem para o Claude (camada 2).
    if ((cat === "esportes" || cat === "esports") && id) return await oracleEsportes(id, q);
  } catch { return null; }
  return null;
}

export async function resolverTopic(supabase: any, topic: Topic): Promise<{ outcome: "paid" | "refunded" | "retry" }> {
  const tentativa = (topic.oracle_retry_count ?? 0) + 1;
  const isMulti = topic.market_type === "multi";

  if (tentativa > MAX_RETRIES) {
    await salvarResolucao(supabase, topic, { resolvido_por: "reembolso", oracle_usado: "nenhum", numero_tentativa: tentativa, resultado_final: "REEMBOLSO" });
    await reembolsarTodos(supabase, topic.id, "Oracle não conseguiu determinar resultado após 3 tentativas");
    await pagarConcursoBets(supabase, topic.id, "cancelled");
    return { outcome: "refunded" };
  }

  // Busca outcomes para mercados multi (necessário para AI e para pagar vencedores)
  let outcomes: { id: string; label: string }[] = [];
  if (isMulti) {
    const { data: outcomeData } = await supabase
      .from("topic_outcomes")
      .select("id, label")
      .eq("topic_id", topic.id)
      .order("position");
    outcomes = outcomeData ?? [];
  }

  // ── CAMADA 1 + 1b: API fixa e auto-detect (somente binário) ────────────
  if (!isMulti) {
    let apiResult: OracleResult | null = null;
    if (topic.oracle_api_id) {
      apiResult = await tentativaApiFixa(topic);
    }
    if (apiResult && apiResult.resultado !== "INCERTO") {
      const resultado = apiResult.resultado.toLowerCase() as "sim" | "nao";
      await salvarResolucao(supabase, topic, {
        resolvido_por: "oracle_api",
        oracle_usado: topic.oracle_api_id ?? "auto_detect",
        numero_tentativa: tentativa,
        resultado_final: apiResult.resultado,
        apiResult,
      });
      await pagarVencedores(supabase, topic.id, resultado);
      await pagarConcursoBets(supabase, topic.id, resultado);
      return { outcome: "paid" };
    }
  }

  // ── CAMADA 2: Claude Haiku ──────────────────────────────────────────────
  let aiResult: Awaited<ReturnType<typeof oracleAITripleCheck>> | null = null;
  try {
    aiResult = await oracleAITripleCheck(
      topic.title,
      topic.closes_at,
      isMulti ? outcomes.map((o) => o.label) : undefined
    );
  } catch (e) {
    console.error("[oracle] Claude falhou:", String(e).slice(0, 200));
  }

  if (aiResult && aiResult.resultado !== "INCERTO") {
    await salvarResolucao(supabase, topic, {
      resolvido_por: "oracle_ai",
      oracle_usado: "claude-haiku-4-5",
      numero_tentativa: tentativa,
      resultado_final: aiResult.resultado,
      aiResult,
    });

    if (isMulti) {
      const winningOutcome = outcomes.find((o) => o.label === aiResult!.resultado);
      if (winningOutcome) {
        await pagarVencedoresMulti(supabase, topic.id, winningOutcome.id);
        await pagarConcursoBetsMulti(supabase, topic.id, winningOutcome.id);
        return { outcome: "paid" };
      }
      // Label não encontrado entre os outcomes — retry
    } else {
      const resultado = aiResult.resultado.toLowerCase() as "sim" | "nao";
      await pagarVencedores(supabase, topic.id, resultado);
      await pagarConcursoBets(supabase, topic.id, resultado);
      return { outcome: "paid" };
    }
  }

  // ── CAMADA 3: INCERTO → agenda retry ───────────────────────────────────
  const nextRetry = new Date(Date.now() + RETRY_INTERVAL_MS).toISOString();
  await supabase.from("topics").update({
    oracle_retry_count: tentativa,
    oracle_next_retry_at: nextRetry,
    status: "resolving",
  }).eq("id", topic.id);
  await salvarResolucao(supabase, topic, {
    resolvido_por: "pendente",
    oracle_usado: "incerto",
    numero_tentativa: tentativa,
    resultado_final: "INCERTO",
    aiResult,
  });
  return { outcome: "retry" };
}
