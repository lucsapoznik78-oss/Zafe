import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF, ERRO_CPF } from "@/lib/cpf";
import { LEGAL_DOCS, DOCS_OBRIGATORIOS } from "@/lib/legal";
import { recordAcceptance } from "@/lib/legal-trail";

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

  // O veredito sobre o CPF fica lá embaixo, junto da checagem de unicidade —
  // ver o comentário no ponto da decisão.
  const cpfLimpo = String(body?.cpf ?? "").replace(/\D/g, "");

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
    update.terms_version = LEGAL_DOCS.termos.version;
    update.terms_accepted_at = new Date().toISOString();
  }

  // Veredito sobre o CPF: dígito e unicidade conferidos juntos e julgados numa
  // resposta só. Separar os dois casos (400 "inválido" vs 409 "já cadastrado")
  // transformava a rota num oráculo de enumeração de CPF; retornar cedo no
  // dígito inválido, sem tocar no banco, reabriria a mesma distinção pelo
  // relógio. O índice parcial profiles_cpf_unique é que fecha o TOCTOU.
  const cpfValido = validarCPF(cpfLimpo);
  const { data: cpfTaken } = await admin
    .from("profiles").select("id").eq("cpf", cpfLimpo).neq("id", user.id).limit(1);
  if (!cpfValido || (cpfTaken && cpfTaken.length > 0)) {
    return NextResponse.json({ error: ERRO_CPF }, { status: 422 });
  }

  const { error } = await admin.from("profiles").update(update).eq("id", user.id);
  if (error) {
    // 23505 = violação do índice UNIQUE de cpf (corrida de dois cadastros).
    // Mesmo veredito do caminho acima — quem perde a corrida não pode receber
    // uma resposta distinguível.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: ERRO_CPF }, { status: 422 });
    }
    console.error("[perfil/completar]", error);
    return NextResponse.json({ error: "Erro ao salvar seus dados" }, { status: 500 });
  }

  // Trilha probatória do aceite (IP + user-agent + hash do texto). Não pode
  // derrubar o cadastro: os dados já foram salvos.
  for (const doc of DOCS_OBRIGATORIOS) {
    try {
      await recordAcceptance({ userId: user.id, document: doc, action: "signup", req: request });
    } catch (e) {
      console.error("[perfil/completar] aceite", doc, e);
    }
  }

  return NextResponse.json({ success: true });
}
