/**
 * Cron oracle — roda de hora em hora
 * 1. Encontra topics com status='resolving' prontos para tentar
 * 2. Resolve cada um via oracle (AI + web search)
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolverTopic } from "@/lib/oracles";

export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");

  let authorized = false;
  if (auth === `Bearer ${process.env.CRON_SECRET}`) {
    authorized = true;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      authorized = profile?.is_admin === true;
    }
  }

  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Usa admin client — cron não tem sessão de usuário, RLS bloquearia todas as escritas
  const supabase = createAdminClient();

  // Busca topics resolving prontos (next_retry no passado ou nulo)
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, category, oracle_api_id, oracle_retry_count, closes_at")
    .eq("status", "resolving")
    .or("oracle_next_retry_at.is.null,oracle_next_retry_at.lte." + new Date().toISOString());

  if (!topics || topics.length === 0) {
    return NextResponse.json({ paid: 0, retrying: 0, total: 0, message: "Nenhum mercado aguardando resolução" });
  }

  let paid = 0;
  let retrying = 0;
  const errors: string[] = [];

  for (const topic of topics) {
    try {
      const result = await resolverTopic(supabase, topic);
      if (result?.outcome === "paid" || result?.outcome === "refunded") {
        paid++;
      } else {
        retrying++;
      }
    } catch (err) {
      errors.push(`${topic.title}: ${String(err)}`);
      console.error(`[oracle] Erro ao resolver ${topic.id}:`, err);
    }
  }

  return NextResponse.json({
    paid,
    retrying,
    total: topics.length,
    resolved: paid, // compat com mensagem do admin
    errors: errors.length > 0 ? errors : undefined,
  });
}
