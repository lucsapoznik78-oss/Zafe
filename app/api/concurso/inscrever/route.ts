import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF } from "@/lib/cpf";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Inscrição no concurso exige identificação completa (prêmio pago em R$ via PIX):
  // username, nome completo e CPF. A senha é reconfirmada no cliente.
  const body = await request.json().catch(() => ({}));
  const fullName = String(body?.fullName ?? "").trim();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const cpfLimpo = String(body?.cpf ?? "").replace(/\D/g, "");

  if (!fullName || fullName.length < 3) {
    return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
  }
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
    return NextResponse.json({ error: "Username inválido (3-20 caracteres: letras, números, _ ou .)" }, { status: 400 });
  }
  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Username único (se mudou para um já usado por outra conta)
  const { data: usernameTaken } = await admin
    .from("profiles").select("id").eq("username", username).neq("id", user.id).limit(1);
  if (usernameTaken && usernameTaken.length > 0) {
    return NextResponse.json({ error: "Username já em uso" }, { status: 409 });
  }

  // CPF único (não pode estar vinculado a outra conta)
  const { data: cpfTaken } = await admin
    .from("profiles").select("id").eq("cpf", cpfLimpo).neq("id", user.id).limit(1);
  if (cpfTaken && cpfTaken.length > 0) {
    return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
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

  const { data: existing } = await admin
    .from("inscricoes_concurso")
    .select("id")
    .eq("user_id", user.id)
    .eq("concurso_id", concurso.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Você já está inscrito neste concurso" }, { status: 400 });
  }

  // Persiste a identificação no perfil antes de inscrever
  const { error: eProfile } = await admin
    .from("profiles")
    .update({ full_name: fullName, username, cpf: cpfLimpo, kyc_verified: true })
    .eq("id", user.id);

  if (eProfile) {
    console.error("[concurso/inscrever] perfil", eProfile);
    return NextResponse.json({ error: "Erro ao salvar seus dados" }, { status: 500 });
  }

  const { error: e1 } = await admin
    .from("inscricoes_concurso")
    .insert({ user_id: user.id, concurso_id: concurso.id });

  if (e1) {
    console.error("[concurso/inscrever]", e1);
    return NextResponse.json({ error: "Erro ao inscrever no concurso" }, { status: 500 });
  }

  const { error: e2 } = await admin
    .from("concurso_wallets")
    .insert({ user_id: user.id, concurso_id: concurso.id, balance: concurso.saldo_inicial });

  if (e2) {
    console.error("[concurso/inscrever]", e2);
    return NextResponse.json({ error: "Erro ao criar carteira do concurso" }, { status: 500 });
  }

  return NextResponse.json({ success: true, balance: concurso.saldo_inicial });
}
