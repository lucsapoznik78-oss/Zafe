import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validarCPF } from "@/lib/cpf";
import { criarCobrancaInscricao } from "@/lib/concurso-pagamento";

/**
 * Cria a cobrança PIX da inscrição num concurso PAGO. A taxa em R$ é só uma taxa
 * (regra de ouro: nunca vira saldo). A entrada só é liberada quando o webhook do
 * provedor confirmar o pagamento. Para concurso grátis, use /api/concurso/inscrever.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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

  const { data: concurso } = await admin
    .from("concursos")
    .select("id, titulo, pago, valor_inscricao_centavos")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return NextResponse.json({ error: "Nenhum concurso ativo no momento" }, { status: 404 });
  }
  if (!concurso.pago || !concurso.valor_inscricao_centavos) {
    return NextResponse.json({ error: "Este concurso é grátis — use a inscrição direta" }, { status: 400 });
  }

  // Já inscrito? Não cobra de novo.
  const { data: existing } = await admin
    .from("inscricoes_concurso")
    .select("id").eq("user_id", user.id).eq("concurso_id", concurso.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Você já está inscrito neste concurso" }, { status: 400 });
  }

  // Unicidade de username / CPF (mesma regra do fluxo grátis).
  const { data: usernameTaken } = await admin
    .from("profiles").select("id").eq("username", username).neq("id", user.id).limit(1);
  if (usernameTaken && usernameTaken.length > 0) {
    return NextResponse.json({ error: "Username já em uso" }, { status: 409 });
  }
  const { data: cpfTaken } = await admin
    .from("profiles").select("id").eq("cpf", cpfLimpo).neq("id", user.id).limit(1);
  if (cpfTaken && cpfTaken.length > 0) {
    return NextResponse.json({ error: "CPF já cadastrado" }, { status: 409 });
  }

  // Persiste a identificação (KYC) antes de gerar a cobrança.
  const { error: eProfile } = await admin
    .from("profiles")
    .update({ full_name: fullName, username, cpf: cpfLimpo, birth_date: birthDate, kyc_verified: true })
    .eq("id", user.id);
  if (eProfile) {
    if ((eProfile as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "CPF ou username já cadastrado" }, { status: 409 });
    }
    console.error("[concurso/pagamento/criar] perfil", eProfile);
    return NextResponse.json({ error: "Erro ao salvar seus dados" }, { status: 500 });
  }

  const result = await criarCobrancaInscricao(admin, {
    userId: user.id,
    concursoId: concurso.id,
    valorCentavos: concurso.valor_inscricao_centavos,
    cpf: cpfLimpo,
    descricao: `Inscrição ${concurso.titulo}`,
  });

  if (!result.ok) {
    if (result.reason === "unconfigured") {
      // Provedor PIX ainda não integrado — registro pendente criado.
      return NextResponse.json(
        { error: "Pagamento por PIX ainda não está disponível. Tente novamente em breve.", pendingId: result.pagamentoId },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Não foi possível gerar a cobrança" }, { status: 502 });
  }

  return NextResponse.json({
    pagamentoId: result.pagamentoId,
    pixCopiaCola: result.cobranca.pixCopiaCola,
    pixQrBase64: result.cobranca.pixQrBase64,
    expiraEm: result.cobranca.expiraEm,
    valorCentavos: concurso.valor_inscricao_centavos,
  });
}
