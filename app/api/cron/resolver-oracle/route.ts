/**
 * Cron oracle — roda de hora em hora
 * 1. Encontra topics com status='resolving' prontos para tentar
 * 2. Resolve cada um via oracle
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolverTopic } from "@/lib/oracles";

export const maxDuration = 300; // 5 minutos (Vercel Pro / hobby limit)

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = await createClient();

  // Busca topics resolving prontos (next_retry no passado ou nulo)
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, category, oracle_api_id, oracle_retry_count, closes_at")
    .eq("status", "resolving")
    .or("oracle_next_retry_at.is.null,oracle_next_retry_at.lte." + new Date().toISOString());

  if (!topics || topics.length === 0) {
    return NextResponse.json({ resolved: 0, message: "Nenhum mercado aguardando resolução" });
  }

  let resolved = 0;
  const errors: string[] = [];

  for (const topic of topics) {
    try {
      await resolverTopic(supabase, topic);
      resolved++;
    } catch (err) {
      errors.push(`${topic.id}: ${String(err)}`);
      console.error(`[oracle] Erro ao resolver ${topic.id}:`, err);
    }
  }

  return NextResponse.json({
    resolved,
    total: topics.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
