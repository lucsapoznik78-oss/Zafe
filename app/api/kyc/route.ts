import { createClient } from "@/lib/supabase/server";
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

  // Verificar se CPF já está em uso por outro usuário
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("cpf", cpfLimpo)
    .neq("id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ cpf: cpfLimpo, kyc_verified: true })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Erro ao salvar CPF" }, { status: 500 });

  return NextResponse.json({ success: true });
}
