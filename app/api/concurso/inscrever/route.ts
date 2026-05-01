import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: concurso } = await admin
    .from("concursos")
    .select("id, saldo_inicial")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return NextResponse.json({ error: "Nenhum concurso ativo no momento" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("inscricoes_concurso")
    .select("id")
    .eq("user_id", user.id)
    .eq("concurso_id", concurso.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Você já está inscrito neste concurso" }, { status: 400 });
  }

  const { error: e1 } = await admin
    .from("inscricoes_concurso")
    .insert({ user_id: user.id, concurso_id: concurso.id });

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const { error: e2 } = await admin
    .from("concurso_wallets")
    .insert({ user_id: user.id, concurso_id: concurso.id, balance: concurso.saldo_inicial });

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ success: true, balance: concurso.saldo_inicial });
}
