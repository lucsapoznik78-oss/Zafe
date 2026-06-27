import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getProviderConfig, confirmarPagamentoEInscrever } from "@/lib/concurso-pagamento";

/**
 * Webhook do provedor PIX: confirma o pagamento da inscrição e libera a entrada.
 * Idempotente (o claim pending→paid só passa uma vez). Público (chamado pelo
 * provedor, sem sessão) — ver publicRoutes no middleware.
 *
 * O provedor ainda não está integrado: enquanto getProviderConfig() for null,
 * este endpoint apenas responde 200 sem efeito. Ao integrar, implemente a
 * verificação de assinatura e o mapeamento payload→(providerPaymentId, status).
 */
export async function POST(request: Request) {
  const config = getProviderConfig();
  const raw = await request.text();

  // Sem provedor configurado: aceita e ignora (evita retries do provedor).
  if (!config) {
    return NextResponse.json({ ok: true, ignored: "unconfigured" });
  }

  // TODO(pagamento): verificar assinatura usando config.webhookSecret e o header
  // de assinatura do provedor escolhido antes de confiar no payload.

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // TODO(pagamento): mapear o payload do provedor para o formato normalizado.
  // Mercado Pago: { type: "payment", data: { id } } → consultar status na API.
  // Pagar.me: { data: { id, status } }. Normalize aqui:
  const providerPaymentId: string | undefined =
    payload?.data?.id?.toString() ?? payload?.providerPaymentId;
  const status: string | undefined = payload?.data?.status ?? payload?.status;

  // CPF do pagador (KYC via PIX): vem da conta bancária verificada que originou o
  // PIX. confirmarPagamentoEInscrever exige que bata com o CPF do perfil.
  // TODO(pagamento): no Mercado Pago, o CPF vem ao consultar GET /v1/payments/{id}
  // em `payer.identification.number` (não no payload do webhook); normalize aqui.
  const payerCpf: string | undefined =
    payload?.payer?.identification?.number ??     // Mercado Pago (payments API)
    payload?.data?.customer?.document ??          // Pagar.me
    payload?.payerCpf;

  if (!providerPaymentId) {
    return NextResponse.json({ ok: true, ignored: "no payment id" });
  }
  if (status && status !== "paid" && status !== "approved") {
    return NextResponse.json({ ok: true, ignored: `status ${status}` });
  }

  const admin = createAdminClient();
  const result = await confirmarPagamentoEInscrever(admin, {
    provider: config.provider,
    providerPaymentId,
    payerCpf,
  });

  // Sempre 200 para o provedor não reentregar; o estado real fica na razão.
  return NextResponse.json({ ok: true, result });
}
