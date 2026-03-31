/**
 * Orquestrador do sistema oracle da Zafe
 * Camada 1: API fixa por categoria
 * Camada 2: AI triple-check
 * Camada 3: Retry em 2h (máx 3 tentativas)
 * Camada 4: Reembolso automático
 */

import { oracleEsportes } from "./sports";
import { oracleEconomia } from "./economia";
import { oraclePolitica } from "./politica";
import { oracleEntretenimento } from "./entretenimento";
import { oracleTecnologia } from "./tecnologia";
import { oracleAITripleCheck, validacaoAI } from "./ai-triple-check";
import { pagarVencedores, reembolsarTodos } from "@/lib/payout";
import type { OracleResult } from "./sports";

const RETRY_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 horas
const MAX_RETRIES = 3;

interface Topic {
  id: string;
  title: string;
  category: string;
  oracle_api_id: string | null;
  oracle_retry_count: number;
  closes_at: string;
}

async function salvarResolucao(
  supabase: any,
  topic: Topic,
  opts: {
    resolvido_por: string;
    oracle_usado: string;
    numero_tentativa: number;
    resultado_final: string;
    apiResult?: OracleResult | null;
    aiResult?: Awaited<ReturnType<typeof oracleAITripleCheck>> | null;
  }
) {
  await supabase.from("resolucoes").insert({
    mercado_id: topic.id,
    resolvido_por: opts.resolvido_por,
    oracle_usado: opts.oracle_usado,
    numero_tentativa: opts.numero_tentativa,
    resultado_final: opts.resultado_final,
    // API fixa não tem triple-check
    check1_resultado: opts.aiResult?.check1.resultado ?? null,
    check1_fonte: opts.aiResult?.check1.fonte ?? null,
    check1_confianca: opts.aiResult?.check1.confianca ?? null,
    check2_resultado: opts.aiResult?.check2.resultado ?? null,
    check2_fonte: opts.aiResult?.check2.fonte ?? null,
    check2_confianca: opts.aiResult?.check2.confianca ?? null,
    check3_resultado: opts.aiResult?.check3.resultado ?? null,
    check3_fonte: opts.aiResult?.check3.fonte ?? null,
    check3_confianca: opts.aiResult?.check3.confianca ?? null,
  });
}

async function tentativaOracleApiFixa(
  topic: Topic
): Promise<OracleResult | null> {
  const id = topic.oracle_api_id ?? "";
  const q = topic.title;
  const cat = topic.category;

  try {
    if (cat === "esportes" && id) return await oracleEsportes(id, q);
    if (cat === "economia" && id) return await oracleEconomia(id, q);
    if (cat === "politica" && id) return await oraclePolitica(id, q);
    if (cat === "entretenimento" && id) return await oracleEntretenimento(id, q);
    if (cat === "tecnologia" && id) return await oracleTecnologia(id, q);
  } catch {
    return null;
  }
  return null;
}

export async function resolverTopic(supabase: any, topic: Topic): Promise<void> {
  const tentativa = (topic.oracle_retry_count ?? 0) + 1;

  // Máximo de tentativas atingido → reembolso
  if (tentativa > MAX_RETRIES) {
    await salvarResolucao(supabase, topic, {
      resolvido_por: "reembolso",
      oracle_usado: "nenhum",
      numero_tentativa: tentativa,
      resultado_final: "REEMBOLSO",
    });
    await reembolsarTodos(supabase, topic.id, "Oracle não conseguiu determinar resultado após 3 tentativas");
    return;
  }

  // ── CAMADA 1: API fixa ──────────────────────────────────────────────────
  let apiResult: OracleResult | null = null;
  if (topic.oracle_api_id) {
    apiResult = await tentativaOracleApiFixa(topic);
  }

  if (apiResult && apiResult.resultado !== "INCERTO") {
    const resultado = apiResult.resultado.toLowerCase() as "sim" | "nao";

    // Validação cruzada com AI para todos os mercados resolvidos por API fixa
    const confirmado = await validacaoAI(topic.title, apiResult.resultado);
    if (!confirmado) {
      // Sinaliza para revisão — não paga ainda
      await supabase.from("topics").update({ status: "resolving" }).eq("id", topic.id);
      await salvarResolucao(supabase, topic, {
        resolvido_por: "api_fixa",
        oracle_usado: topic.oracle_api_id!,
        numero_tentativa: tentativa,
        resultado_final: "SINALIZADO_REVISAO",
        apiResult,
      });
      console.warn(`[oracle] Mercado ${topic.id} sinalizado para revisão manual (AI não confirmou)`);
      return;
    }

    await salvarResolucao(supabase, topic, {
      resolvido_por: "api_fixa",
      oracle_usado: topic.oracle_api_id!,
      numero_tentativa: tentativa,
      resultado_final: apiResult.resultado,
      apiResult,
    });
    await pagarVencedores(supabase, topic.id, resultado);
    return;
  }

  // ── CAMADA 2: AI Triple-Check ───────────────────────────────────────────
  const aiResult = await oracleAITripleCheck(topic.title, topic.closes_at);

  if (aiResult.resultado !== "INCERTO") {
    const resultado = aiResult.resultado.toLowerCase() as "sim" | "nao";
    await salvarResolucao(supabase, topic, {
      resolvido_por: "oracle_ai",
      oracle_usado: "claude-opus-4-6",
      numero_tentativa: tentativa,
      resultado_final: aiResult.resultado,
      aiResult,
    });
    await pagarVencedores(supabase, topic.id, resultado);
    return;
  }

  // ── CAMADA 3: INCERTO → agenda retry ───────────────────────────────────
  await salvarResolucao(supabase, topic, {
    resolvido_por: "pendente",
    oracle_usado: topic.oracle_api_id ? `${topic.oracle_api_id}+claude` : "claude-opus-4-6",
    numero_tentativa: tentativa,
    resultado_final: "INCERTO",
    aiResult,
  });

  const nextRetry = new Date(Date.now() + RETRY_INTERVAL_MS).toISOString();
  await supabase.from("topics").update({
    oracle_retry_count: tentativa,
    oracle_next_retry_at: nextRetry,
    status: "resolving",
  }).eq("id", topic.id);

  console.log(`[oracle] Mercado ${topic.id} incerto — próxima tentativa: ${nextRetry}`);
}
