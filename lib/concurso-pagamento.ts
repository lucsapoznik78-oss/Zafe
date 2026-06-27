/**
 * Concurso PAGO — cobrança da inscrição (taxa R$) e razão de prêmios (R$ via PIX).
 *
 * Regra de ouro: a inscrição em R$ é uma TAXA. NUNCA vira saldo Z$/ZC$ e não há
 * conversão R$↔virtual. Ao confirmar o pagamento, liberamos a entrada no concurso
 * (concurso_inscrever) — a carteira ZC$ recebe só o `saldo_inicial` de pontuação,
 * que não representa o R$ pago.
 *
 * O provedor PIX (Mercado Pago / Pagar.me / Stripe-BR) e a conta bancária/CNPJ
 * ainda NÃO estão integrados. `criarCobrancaInscricao` deixa o registro pronto e
 * devolve `unconfigured` enquanto não houver credenciais. O ponto único onde o
 * provedor real entra é `criarCobrancaNoProvedor` — basta implementá-lo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PixProvider = "mercadopago" | "pagarme" | "stripe";

export interface ProviderConfig {
  provider: PixProvider;
  accessToken: string;
  webhookSecret: string | null;
}

/** Lê a configuração do provedor do ambiente. `null` enquanto não configurado. */
export function getProviderConfig(): ProviderConfig | null {
  const provider = process.env.PIX_PROVIDER as PixProvider | undefined;
  const accessToken = process.env.PIX_PROVIDER_ACCESS_TOKEN;
  if (!provider || !accessToken) return null;
  return {
    provider,
    accessToken,
    webhookSecret: process.env.PIX_PROVIDER_WEBHOOK_SECRET ?? null,
  };
}

export interface CobrancaPix {
  providerPaymentId: string;
  pixCopiaCola: string;
  pixQrBase64: string | null;
  expiraEm: string | null;
}

/**
 * Seam do provedor real. Recebe valor + identificação e cria a cobrança PIX.
 * TODO(pagamento): implementar a chamada ao provedor escolhido usando `config`.
 * Enquanto não houver provedor, `getProviderConfig()` devolve null e este código
 * não é alcançado.
 */
async function criarCobrancaNoProvedor(
  _config: ProviderConfig,
  _params: { valorCentavos: number; descricao: string; cpf: string; pagamentoId: string }
): Promise<CobrancaPix> {
  // Implementação por provedor entra aqui (ex.: POST /v1/payments no Mercado Pago,
  // com X-Idempotency-Key = pagamentoId, payment_method_id "pix").
  throw new Error("PIX provider not implemented");
}

export type CriarCobrancaResult =
  | { ok: true; pagamentoId: string; cobranca: CobrancaPix }
  | { ok: false; reason: "unconfigured" | "provider_error"; pagamentoId: string };

/**
 * Cria (ou reusa) uma cobrança PIX pendente para a inscrição do usuário no
 * concurso pago. Reusa um pagamento `pending` não expirado existente para evitar
 * múltiplas cobranças. Devolve `unconfigured` quando ainda não há provedor PIX.
 */
export async function criarCobrancaInscricao(
  admin: SupabaseClient,
  params: { userId: string; concursoId: string; valorCentavos: number; cpf: string; descricao: string }
): Promise<CriarCobrancaResult> {
  const { userId, concursoId, valorCentavos, cpf, descricao } = params;
  const config = getProviderConfig();

  // Reaproveita cobrança pendente ainda válida.
  const { data: existing } = await admin
    .from("pagamentos_concurso")
    .select("id, status, provider_payment_id, pix_copia_cola, pix_qr_base64, expira_em")
    .eq("user_id", userId)
    .eq("concurso_id", concursoId)
    .eq("status", "pending")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const naoExpirou = (e: { expira_em: string | null }) =>
    !e.expira_em || new Date(e.expira_em).getTime() > Date.now();

  if (existing && existing.provider_payment_id && existing.pix_copia_cola && naoExpirou(existing)) {
    return {
      ok: true,
      pagamentoId: existing.id,
      cobranca: {
        providerPaymentId: existing.provider_payment_id,
        pixCopiaCola: existing.pix_copia_cola,
        pixQrBase64: existing.pix_qr_base64,
        expiraEm: existing.expira_em,
      },
    };
  }

  const pagamentoId = existing?.id ?? null;

  // Garante o registro pendente (fonte de verdade), com ou sem provedor.
  let id = pagamentoId;
  if (!id) {
    const { data: inserted, error } = await admin
      .from("pagamentos_concurso")
      .insert({
        user_id: userId,
        concurso_id: concursoId,
        provider: config?.provider ?? "unconfigured",
        status: "pending",
        valor_centavos: valorCentavos,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[concurso-pagamento] insert pendente falhou", error);
      return { ok: false, reason: "provider_error", pagamentoId: "" };
    }
    id = inserted.id;
  }

  if (!config) {
    return { ok: false, reason: "unconfigured", pagamentoId: id };
  }

  try {
    const cobranca = await criarCobrancaNoProvedor(config, {
      valorCentavos,
      descricao,
      cpf,
      pagamentoId: id,
    });
    await admin
      .from("pagamentos_concurso")
      .update({
        provider: config.provider,
        provider_payment_id: cobranca.providerPaymentId,
        pix_copia_cola: cobranca.pixCopiaCola,
        pix_qr_base64: cobranca.pixQrBase64,
        expira_em: cobranca.expiraEm,
      })
      .eq("id", id);
    return { ok: true, pagamentoId: id, cobranca };
  } catch (e) {
    console.error("[concurso-pagamento] provedor falhou", e);
    return { ok: false, reason: "provider_error", pagamentoId: id };
  }
}

export type ConfirmarResult =
  | { ok: true; status: "enrolled" | "already" }
  | { ok: false; reason: "not_found" | "already_paid" | "enroll_failed" | "cpf_mismatch" | "cpf_unverified" };

/**
 * Confirma um pagamento (chamado pelo webhook do provedor) e libera a entrada no
 * concurso. Idempotente: o claim `pending → paid` só passa uma vez, então uma
 * segunda notificação do provedor não inscreve duas vezes.
 *
 * Verificação de CPF (KYC via PIX): o PIX sempre sai de uma conta bancária já
 * verificada pelo banco e amarrada a um CPF regular na Receita. Então o CPF do
 * pagador que o provedor devolve é uma verificação real e gratuita. Exigimos que
 * ele bata com o CPF do perfil; caso contrário NÃO inscrevemos e marcamos o
 * pagamento como `cpf_mismatch` (pagador ≠ perfil) ou `cpf_unverified` (provedor
 * não informou o CPF) — estado terminal que precisa de refund/revisão manual.
 */
export async function confirmarPagamentoEInscrever(
  admin: SupabaseClient,
  params: { provider: string; providerPaymentId: string; payerCpf?: string | null }
): Promise<ConfirmarResult> {
  const { provider, providerPaymentId, payerCpf } = params;

  const { data: pagamento } = await admin
    .from("pagamentos_concurso")
    .select("id, user_id, concurso_id, status")
    .eq("provider", provider)
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  if (!pagamento) return { ok: false, reason: "not_found" };
  if (pagamento.status === "paid") return { ok: false, reason: "already_paid" };

  // KYC via PIX: o CPF do pagador precisa bater com o CPF do perfil antes de
  // efetivar. Fail-closed — sem CPF do pagador, não inscrevemos.
  const cpfPagador = (payerCpf ?? "").replace(/\D/g, "");
  const { data: profile } = await admin
    .from("profiles")
    .select("cpf")
    .eq("id", pagamento.user_id)
    .maybeSingle();
  const cpfPerfil = (profile?.cpf ?? "").replace(/\D/g, "");

  if (!cpfPagador) {
    await admin
      .from("pagamentos_concurso")
      .update({ status: "cpf_unverified" })
      .eq("id", pagamento.id)
      .eq("status", "pending");
    console.error("[concurso-pagamento] pagador sem CPF — inscrição bloqueada", pagamento.id);
    return { ok: false, reason: "cpf_unverified" };
  }
  if (cpfPagador !== cpfPerfil) {
    await admin
      .from("pagamentos_concurso")
      .update({ status: "cpf_mismatch" })
      .eq("id", pagamento.id)
      .eq("status", "pending");
    console.error("[concurso-pagamento] CPF do pagador ≠ perfil — inscrição bloqueada", pagamento.id);
    return { ok: false, reason: "cpf_mismatch" };
  }

  // Claim atômico pending→paid: só o primeiro webhook efetiva.
  const { data: claimed } = await admin
    .from("pagamentos_concurso")
    .update({ status: "paid", pago_em: new Date().toISOString() })
    .eq("id", pagamento.id)
    .eq("status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) return { ok: false, reason: "already_paid" };

  // Taxa confirmada → libera a entrada (carteira ZC$ via RPC atômico 031).
  const { data: result, error } = await admin.rpc("concurso_inscrever", {
    p_user: pagamento.user_id,
    p_concurso: pagamento.concurso_id,
  });
  if (error || !result) {
    console.error("[concurso-pagamento] inscrever pós-pagamento falhou", error);
    return { ok: false, reason: "enroll_failed" };
  }
  return { ok: true, status: result.status === "already_enrolled" ? "already" : "enrolled" };
}

/**
 * Registra na razão `payouts_concurso` os prêmios fixos dos vencedores de um
 * concurso. Idempotente por UNIQUE(user_id, concurso_id). O envio do PIX pode ser
 * manual no início — esta razão é a fonte de verdade do que será pago.
 */
export async function registrarPayoutsVencedores(
  admin: SupabaseClient,
  concursoId: string,
  vencedores: { userId: string; posicao: number; valorCentavos: number }[]
): Promise<number> {
  const rows = vencedores
    .filter((v) => v.valorCentavos > 0)
    .map((v) => ({
      user_id: v.userId,
      concurso_id: concursoId,
      posicao: v.posicao,
      valor_centavos: v.valorCentavos,
      status: "pending",
    }));
  if (rows.length === 0) return 0;

  const { error } = await admin
    .from("payouts_concurso")
    .upsert(rows, { onConflict: "user_id,concurso_id", ignoreDuplicates: true });
  if (error) {
    console.error("[concurso-pagamento] registrar payouts falhou", error);
    return 0;
  }
  return rows.length;
}
