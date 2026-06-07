/**
 * Cron: criar-concurso-mensal
 * Garante que exista um concurso ATIVO para o mês corrente. Roda diariamente:
 * no primeiro dia de cada mês cria a nova temporada (carteira ZC$ e ranking
 * recomeçam do zero, pois tudo é chaveado por concurso_id). Nos demais dias é
 * no-op (já existe um ativo). A finalização da temporada anterior (emails do
 * top 5% + status 'apurando') continua a cargo do cron finalizar-concurso.
 *
 * Frequência sugerida: diária, logo após a virada do mês.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

async function isAdminRequest(): Promise<boolean> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  const authorized = verifyCronAuth(req) || (await isAdminRequest());
  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("garantir_concurso_do_mes");

  if (error) {
    console.error("[criar-concurso-mensal]", error);
    return NextResponse.json({ error: "Erro ao garantir concurso do mês" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, concurso_id: data });
}
