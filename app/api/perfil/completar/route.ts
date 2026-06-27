import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF } from "@/lib/cpf";

// Completar cadastro (gate pós-login). CPF é sempre obrigatório e entra por aqui
// — nunca no user_metadata do signup (regra da migration 051). Nascimento e
// endereço são exigidos só quando ainda faltam (ex.: login via Google, que não
// passa pelo form de cadastro por email).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const cpfLimpo = String(body?.cpf ?? "").replace(/\D/g, "");
  if (!validarCPF(cpfLimpo)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  // cpf/kyc_verified são service-role-only (migration 042); escrita via admin.
  const admin = createAdminClient();

  // Estado atual: define o que ainda falta coletar.
  const { data: prof } = await admin
    .from("profiles")
    .select("birth_date, cep")
    .eq("id", user.id)
    .single();

  const update: Record<string, unknown> = { cpf: cpfLimpo, kyc_verified: true };

  // Nascimento — exigido só se ainda não houver. Sem gate de 18+ aqui: a
  // maioridade é exclusiva do Concurso (prêmio em R$); menores usam o resto.
  if (!prof?.birth_date) {
    const birthDate = String(body?.birthDate ?? "").trim();
    const nascimento = new Date(birthDate);
    if (!birthDate || Number.isNaN(nascimento.getTime()) || nascimento.getTime() > Date.now()) {
      return NextResponse.json({ error: "Informe uma data de nascimento válida" }, { status: 400 });
    }
    update.birth_date = birthDate;
  }

  // Endereço (AML) — exigido só se ainda não houver.
  if (!prof?.cep) {
    const cep = String(body?.cep ?? "").replace(/\D/g, "");
    const logradouro = String(body?.logradouro ?? "").trim();
    const numero = String(body?.numero ?? "").trim();
    const bairro = String(body?.bairro ?? "").trim();
    const cidade = String(body?.cidade ?? "").trim();
    const uf = String(body?.uf ?? "").trim().toUpperCase();
    const complemento = String(body?.complemento ?? "").trim();
    if (cep.length !== 8 || !logradouro || !numero || !bairro || !cidade || uf.length !== 2) {
      return NextResponse.json({ error: "Preencha o endereço completo" }, { status: 400 });
    }
    update.cep = cep;
    update.logradouro = logradouro;
    update.numero = numero;
    update.bairro = bairro;
    update.cidade = cidade;
    update.uf = uf;
    update.complemento = complemento || null;
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
