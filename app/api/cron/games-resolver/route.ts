/**
 * Cron: games-resolver
 * Resolve eventos da Zafe Games já iniciados (starts_at + 30min) via o
 * provedor de resultados (adapter trocável). Eventos sem veredito confiável
 * ficam aguardando (live) ou vão para resolução manual do admin — NUNCA
 * pagam automaticamente sem fonte confiável.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> OU profiles.is_admin.
 */

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { resolveDueEvents } from "@/lib/games/resolve";

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
  const summaries = await resolveDueEvents(admin);

  return NextResponse.json({
    success: true,
    processed: summaries.length,
    applied: summaries.filter((s) => s.outcome === "applied").length,
    not_final: summaries.filter((s) => s.outcome === "not_final").length,
    summaries,
  });
}

export const GET = POST;
