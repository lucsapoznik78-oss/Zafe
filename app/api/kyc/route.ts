import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF } from "@/lib/cpf";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { cpf } = await request.json();
  if (!cpf) return NextResponse.json({ error: "CPF obrigatório" }, { status: 400 });

  const cpfLimpo = cpf.replace(/\D/g, "");

  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  // cpf/kyc_verified são colunas privilegiadas (service-role-only após
  // migration 042). A escrita usa o admin client — o client do usuário não
  // tem mais GRANT nessas colunas (G7).
  const admin = createAdminClient();

  // Verificação prévia (UX). A garantia real de unicidade é o índice parcial
  // UNIQUE profiles_cpf_unique (migration 042): fecha o TOCTOU de dois
  // cadastros concorrentes do mesmo CPF (Sybil no concurso com prêmio em R$).
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("cpf", cpfLimpo)
    .neq("id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ cpf: cpfLimpo, kyc_verified: true })
    .eq("id", user.id);

  if (error) {
    // 23505 = violação de UNIQUE (corrida no índice profiles_cpf_unique).
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao salvar CPF" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
