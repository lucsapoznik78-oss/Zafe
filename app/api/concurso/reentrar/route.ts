import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Reentrada no concurso do mês corrente para usuários JÁ verificados em uma
 * temporada anterior (kyc_verified + cpf + birth_date no perfil). Como o
 * concurso reinicia todo mês, o participante não precisa refazer o KYC: basta
 * um clique para receber a carteira ZC$ renovada na nova temporada.
 * Quem ainda não é verificado deve passar pelo fluxo completo (/concurso/entrar).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: perfil } = await admin
    .from("profiles")
    .select("kyc_verified, cpf, birth_date")
    .eq("id", user.id)
    .single();

  if (!perfil?.kyc_verified || !perfil.cpf || !perfil.birth_date) {
    return NextResponse.json(
      { error: "Complete seu cadastro para participar", needsKyc: true },
      { status: 403 }
    );
  }

  // Revalida 18+ (gate exclusivo do concurso, prêmio em R$ via PIX).
  const nascimento = new Date(perfil.birth_date);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  if (idade < 18) {
    return NextResponse.json({ error: "O concurso é exclusivo para maiores de 18 anos" }, { status: 403 });
  }

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

  // Inscrição + carteira ZC$ numa única transação (RPC migration 031).
  // Se já inscrito, devolve o saldo REAL da carteira — antes devolvia o
  // saldo_inicial do concurso, mostrando ZC$ errado na UI (audit N18).
  const { data: result, error: eRpc } = await admin.rpc("concurso_inscrever", {
    p_user: user.id,
    p_concurso: concurso.id,
  });

  if (eRpc || !result) {
    console.error("[concurso/reentrar]", eRpc);
    return NextResponse.json({ error: "Erro ao inscrever no concurso" }, { status: 500 });
  }
  if (result.status === "not_active") {
    return NextResponse.json({ error: "Nenhum concurso ativo no momento" }, { status: 404 });
  }

  return NextResponse.json({ success: true, balance: Number(result.balance) });
}
