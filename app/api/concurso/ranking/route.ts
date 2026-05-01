import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: concurso } = await admin
    .from("concursos")
    .select("id")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) return NextResponse.json({ ranking: [] });

  const { data: ranking } = await admin
    .from("v_concurso_ranking")
    .select("*")
    .eq("concurso_id", concurso.id)
    .order("posicao", { ascending: true })
    .limit(50);

  return NextResponse.json({ ranking: ranking ?? [] });
}
