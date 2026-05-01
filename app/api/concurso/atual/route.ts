import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: concurso } = await admin
    .from("concursos")
    .select("*")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return NextResponse.json({ concurso: null, enrolled: false, wallet: null });
  }

  if (!user) {
    return NextResponse.json({ concurso, enrolled: false, wallet: null });
  }

  const [{ data: inscricao }, { data: wallet }] = await Promise.all([
    admin.from("inscricoes_concurso")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("concurso_id", concurso.id)
      .single(),
    admin.from("concurso_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .eq("concurso_id", concurso.id)
      .single(),
  ]);

  return NextResponse.json({
    concurso,
    enrolled: !!inscricao,
    wallet: wallet ?? null,
  });
}
