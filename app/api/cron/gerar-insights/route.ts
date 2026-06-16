/**
 * Pré-geração de Insights Premium (cron).
 *
 * Gera/cacheia o insight de IA dos eventos ativos ANTES de qualquer acesso, para
 * que o painel apareça instantâneo (cache hit) e o Premium nunca espere os ~10-30s
 * da geração síncrona. `getOrGenerateInsights` pula quem já tem cache fresco (<24h),
 * então rodar de novo é barato e idempotente.
 *
 * Modelo barato (Haiku) + buscas limitadas; cap por execução para limitar custo.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { getOrGenerateInsights } from "@/lib/premium/insights";

// Geração faz web search + 2 chamadas Claude por evento, em série — precisa de
// janela larga. Mesmo teto de resolver-oracle.
export const maxDuration = 300;

// Teto de eventos por execução (limita custo de API por run).
const BATCH_LIMIT = 40;

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Eventos abertos (Liga, Econômico e Concurso vivem todos em `topics`),
  // priorizando os que fecham primeiro.
  const { data: topics } = await admin
    .from("topics")
    .select("id, title, description, category, closes_at")
    .eq("status", "active")
    .gt("closes_at", now)
    .order("closes_at", { ascending: true })
    .limit(BATCH_LIMIT);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const topic of topics ?? []) {
    try {
      const content = await getOrGenerateInsights(admin, topic);
      if (content) generated++;
      else failed++;
    } catch {
      failed++;
    }
  }

  skipped = (topics?.length ?? 0) - generated - failed;
  return NextResponse.json({ total: topics?.length ?? 0, generated, skipped, failed });
}
