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
  const birthDate = String(body?.birthDate ?? "").trim();

  if (!fullName || fullName.length < 3) {
    return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
  }
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
    return NextResponse.json({ error: "Username inválido (3-20 caracteres: letras, números, _ ou .)" }, { status: 400 });
  }
  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }
  // Gate 18+: exclusivo do Concurso (prêmio em R$ via PIX). Menores podem usar
  // o restante da plataforma (Liga/Econômico/Privadas/Comunidade).
  const nascimento = new Date(birthDate);
  if (!birthDate || Number.isNaN(nascimento.getTime())) {
    return NextResponse.json({ error: "Informe sua data de nascimento" }, { status: 400 });
  }
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  if (idade < 18) {
    return NextResponse.json({ error: "O concurso é exclusivo para maiores de 18 anos" }, { status: 403 });
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

  // Persiste a identificação no perfil antes de inscrever
  const { error: eProfile } = await admin
    .from("profiles")
    .update({ full_name: fullName, username, cpf: cpfLimpo, birth_date: birthDate, kyc_verified: true })
    .eq("id", user.id);

  if (eProfile) {
    // 23505 = corrida no índice UNIQUE de cpf/username (migration 042).
    if ((eProfile as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "CPF ou username já cadastrado" }, { status: 409 });
    }
    console.error("[concurso/inscrever] perfil", eProfile);
    return NextResponse.json({ error: "Erro ao salvar seus dados" }, { status: 500 });
  }

  // Inscrição + carteira ZC$ numa única transação (RPC migration 031) —
  // grava o saldo_inicial real do concurso e elimina o estado parcial
  // inscrição-sem-carteira (audit N6/N7).
  const { data: result, error: eRpc } = await admin.rpc("concurso_inscrever", {
    p_user: user.id,
    p_concurso: concurso.id,
  });

  if (eRpc || !result) {
    console.error("[concurso/inscrever]", eRpc);
    return NextResponse.json({ error: "Erro ao inscrever no concurso" }, { status: 500 });
  }
  if (result.status === "not_active") {
    return NextResponse.json({ error: "Nenhum concurso ativo no momento" }, { status: 404 });
  }
  if (result.status === "already_enrolled") {
    return NextResponse.json({ error: "Você já está inscrito neste concurso" }, { status: 400 });
  }

  return NextResponse.json({ success: true, balance: Number(result.balance) });
}
