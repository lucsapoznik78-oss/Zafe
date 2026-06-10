/**
 * Cron: copa-resolver
 * Resolve partidas da Zafe Copa já disputadas (kickoff + 2h) via oráculo
 * Claude (double-check com web search) e aplica a pontuação determinística.
 * Partidas sem veredito confiável vão para revisão manual (under_review).
 *
 * Frequência: diária via vercel.json; durante a Copa, o admin pode
 * disparar manualmente ("Resolver agora") — sessão admin é aceita.
 * Auth: Authorization: Bearer <CRON_SECRET> OU profiles.is_admin.
 */

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { resolveDueMatches } from "@/lib/copa/resolve";

async function isAdminRequest(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin === true;
}

export async function POST(request: Request) {
  if (!verifyCronAuth(request) && !(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summaries = await resolveDueMatches(admin);

  return NextResponse.json({
    success: true,
    processed: summaries.length,
    applied: summaries.filter((s) => s.outcome === "applied").length,
    under_review: summaries.filter((s) => s.outcome === "under_review").length,
    summaries,
  });
}

export const GET = POST;
