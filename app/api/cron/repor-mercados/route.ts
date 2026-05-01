/**
 * Cron: Repor mercados públicos
 * Roda a cada hora (:45) e garante que sempre há TARGET_LARGE + TARGET_SMALL mercados ativos.
 * Cria novos tópicos a partir do pool em topic_templates.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { replenishMarkets } from "@/lib/auto-replenish";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result = await replenishMarkets(supabase);

  return NextResponse.json({ ok: true, ...result });
}
