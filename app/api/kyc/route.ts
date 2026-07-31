import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF, ERRO_CPF } from "@/lib/cpf";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { cpf } = await request.json();
  if (!cpf) return NextResponse.json({ error: "CPF obrigatório" }, { status: 400 });

  const cpfLimpo = cpf.replace(/\D/g, "");

  // cpf/kyc_verified são colunas privilegiadas (service-role-only após
  // migration 042). A escrita usa o admin client — o client do usuário não
  // tem mais GRANT nessas colunas (G7).
  const admin = createAdminClient();

  // Dígito e unicidade são conferidos juntos, e só depois julgados, para que os
  // dois caminhos façam o mesmo trabalho. Se o `validarCPF` retornasse cedo, o
  // CPF inválido responderia sem tocar no banco e o duplicado responderia
  // depois do SELECT — uma diferença de ~10-50ms que reabre pelo relógio a
  // distinção que o ERRO_CPF fecha no corpo e no status.
  //
  // O SELECT é só UX/mensagem. A garantia real de unicidade é o índice parcial
  // UNIQUE profiles_cpf_unique (migration 042): fecha o TOCTOU de dois
  // cadastros concorrentes do mesmo CPF (Sybil no concurso com prêmio em R$).
  const valido = validarCPF(cpfLimpo);
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("cpf", cpfLimpo)
    .neq("id", user.id)
    .limit(1);

  if (!valido || (existing && existing.length > 0)) {
    return NextResponse.json({ error: ERRO_CPF }, { status: 422 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ cpf: cpfLimpo, kyc_verified: true })
    .eq("id", user.id);

  if (error) {
    // 23505 = violação de UNIQUE (corrida no índice profiles_cpf_unique).
    // Mesmo veredito do caminho acima: quem perdeu a corrida não pode receber
    // uma resposta diferente de quem digitou o dígito errado.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: ERRO_CPF }, { status: 422 });
    }
    return NextResponse.json({ error: "Erro ao salvar CPF" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
