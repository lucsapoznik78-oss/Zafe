import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcularSplit, SAQUE_MINIMO } from "@/lib/financeiro";
import { sendPushToUser } from "@/lib/webpush";
// Leia lib/financeiro.ts para entender a separação de contas antes de integrar pagamento.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { amount } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });

  // Split: 4% → CONTA OPERACIONAL (receita Zafe), 96% → CONTA CUSTÓDIA (pertence ao usuário)
  // Ver: lib/financeiro.ts → CONTA_OPERACIONAL / CONTA_CUSTODIA
  const { comissao, liquido: netAmount } = calcularSplit(amount);

  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  const currentBalance = wallet?.balance ?? 0;

  // Creditamos apenas o valor líquido (96%) na carteira do usuário.
  // Os 4% (comissão) já foram direcionados à CONTA OPERACIONAL no processador de pagamento.
  await supabase.from("wallets").update({ balance: currentBalance + netAmount }).eq("user_id", user.id);

  await supabase.from("transactions").insert([
    {
      user_id: user.id,
      type: "deposit",
      amount,
      net_amount: netAmount,
      description: `Depósito de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}`,
      // account: CONTA_CUSTODIA — direcionar no gateway de pagamento
    },
    {
      user_id: user.id,
      type: "commission",
      amount: comissao,
      net_amount: comissao,
      description: "Comissão Zafe (4%)",
      // account: CONTA_OPERACIONAL — direcionar no gateway de pagamento
    },
  ]);

  // ── Bônus de referral — pagar R$5 para ambos no primeiro depósito ──
  const { count: depositCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "deposit");

  const isPrimeiroDeposito = (depositCount ?? 0) === 1; // acabou de ser inserido, conta 1

  if (isPrimeiroDeposito) {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("id", user.id)
      .single();

    if (myProfile?.referred_by) {
      const { data: referral } = await supabase
        .from("referrals")
        .select("id, status")
        .eq("referred_id", user.id)
        .eq("status", "pending")
        .single();

      if (referral) {
        const BONUS = 5;

        // Bônus para quem foi indicado
        const { data: myWallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
        await supabase.from("wallets").update({ balance: (myWallet?.balance ?? 0) + BONUS }).eq("user_id", user.id);
        await supabase.from("transactions").insert({
          user_id: user.id, type: "referral_bonus", amount: BONUS, net_amount: BONUS,
          description: "Bônus de boas-vindas — indicado por amigo",
        });

        // Bônus para quem indicou
        const { data: refWallet } = await supabase.from("wallets").select("balance").eq("user_id", myProfile.referred_by).single();
        await supabase.from("wallets").update({ balance: (refWallet?.balance ?? 0) + BONUS }).eq("user_id", myProfile.referred_by);
        await supabase.from("transactions").insert({
          user_id: myProfile.referred_by, type: "referral_bonus", amount: BONUS, net_amount: BONUS,
          description: "Bônus de referral — amigo fez primeiro depósito",
        });
        const referralBody = `Seu amigo fez o primeiro depósito. R$ ${BONUS},00 creditados na sua carteira.`;
        await supabase.from("notifications").insert({
          user_id: myProfile.referred_by, type: "market_resolved",
          title: "Bônus de referral! 🎉",
          body: referralBody,
        });
        sendPushToUser(supabase, myProfile.referred_by, {
          title: "Bônus de referral! 🎉",
          body: referralBody,
          url: "/perfil",
        }).catch(() => {});

        // Marcar referral como concluído
        await supabase.from("referrals").update({
          status: "completed",
          bonus_paid_at: new Date().toISOString(),
        }).eq("id", referral.id);
      }
    }
  }

  return NextResponse.json({ success: true, net_amount: netAmount });
}
