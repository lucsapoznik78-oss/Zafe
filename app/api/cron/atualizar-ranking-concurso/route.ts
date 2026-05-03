/**
 * Cron: atualizar-ranking-concurso
 * Recalcula o ranking do concurso ativo com base no saldo ZC$ atual.
 * Atualiza posicao_atual em inscricoes_concurso.
 *
 * Frequência sugerida: diária (ex: 23:00 BRT).
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function POST(req: Request) {
  const authorized =
    verifyCronAuth(req) ||
    (async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      return profile?.is_admin === true;
    })();

  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Buscar concurso ativo
  const { data: concurso } = await admin
    .from("concursos")
    .select("id, saldo_inicial")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return NextResponse.json({ ok: true, message: "Nenhum concurso ativo", atualizados: 0 });
  }

  // Buscar todas as carteiras do concurso ordenadas por saldo desc
  const { data: wallets, error } = await admin
    .from("concurso_wallets")
    .select("user_id, balance")
    .eq("concurso_id", concurso.id)
    .order("balance", { ascending: false });

  if (error || !wallets) {
    return NextResponse.json({ error: "Falha ao buscar wallets do concurso" }, { status: 500 });
  }

  // Atualizar posicao_atual em inscricoes_concurso para cada inscrito
  let atualizados = 0;
  for (let i = 0; i < wallets.length; i++) {
    const { user_id, balance } = wallets[i];
    const posicao = i + 1;

    const { error: upErr } = await admin
      .from("inscricoes_concurso")
      .update({
        posicao_atual: posicao,
        saldo_atual: balance,
      })
      .eq("user_id", user_id)
      .eq("concurso_id", concurso.id);

    if (!upErr) atualizados++;
  }

  return NextResponse.json({
    ok: true,
    concurso_id: concurso.id,
    total_inscritos: wallets.length,
    atualizados,
  });
}
