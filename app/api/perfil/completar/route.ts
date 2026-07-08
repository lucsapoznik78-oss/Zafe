import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF } from "@/lib/cpf";
import { TERMS_VERSION } from "@/lib/terms";

// Completar cadastro (gate pós-login) — o "Finalize seu cadastro" do fluxo
// Google e de qualquer conta que ainda não tenha CPF. Coleta nome completo,
// telefone, CPF (sempre), nascimento (se faltar) e registra o aceite dos
// termos. cpf/kyc_verified são service-role-only (migration 042).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const fullName = String(body?.fullName ?? "").trim();
  if (fullName.length < 3) {
    return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
  }

  const phone = String(body?.phone ?? "").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: "Informe um telefone válido com DDD" }, { status: 400 });
  }

  const cpfLimpo = String(body?.cpf ?? "").replace(/\D/g, "");
  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  if (!body?.acceptedTerms) {
    return NextResponse.json({ error: "Você precisa aceitar os Termos de Uso" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("birth_date, terms_version")
    .eq("id", user.id)
    .single();

  const update: Record<string, unknown> = {
    cpf: cpfLimpo,
    kyc_verified: true,
    full_name: fullName,
    phone,
  };

  // Nascimento — exigido só se ainda não houver. Sem gate de 18+ aqui: a
  // maioridade é exclusiva do Concurso (prêmio em R$); menores usam o resto.
  if (!prof?.birth_date) {
    const birthDate = String(body?.birthDate ?? "").trim();
    const nascimento = new Date(birthDate);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(nascimento.getTime()) ||
      nascimento.getTime() > Date.now()
    ) {
      return NextResponse.json({ error: "Informe uma data de nascimento válida" }, { status: 400 });
    }
    update.birth_date = birthDate;
  }

  // Aceite dos termos (contas Google não passam pelo form de signup)
  if (!prof?.terms_version) {
    update.terms_version = TERMS_VERSION;
    update.terms_accepted_at = new Date().toISOString();
  }

  // CPF único (índice parcial profiles_cpf_unique fecha a corrida TOCTOU).
  const { data: cpfTaken } = await admin
    .from("profiles").select("id").eq("cpf", cpfLimpo).neq("id", user.id).limit(1);
  if (cpfTaken && cpfTaken.length > 0) {
    return NextResponse.json({ error: "CPF já cadastrado em outra conta" }, { status: 409 });
  }

  const { error } = await admin.from("profiles").update(update).eq("id", user.id);
  if (error) {
    // 23505 = violação do índice UNIQUE de cpf (corrida de dois cadastros).
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "CPF já cadastrado em outra conta" }, { status: 409 });
    }
    console.error("[perfil/completar]", error);
    return NextResponse.json({ error: "Erro ao salvar seus dados" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
