import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { amount } = await request.json();
  if (!amount || amount <= 0 || amount > 1000) {
    return NextResponse.json({ error: "Valor inválido (máx. Z$ 1.000 por depósito)" }, { status: 400 });
  }

  // 1 depósito por semana
  const { data: ultimoDeposito } = await supabase
    .from("transactions")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("type", "deposit")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (ultimoDeposito?.created_at) {
    const ultimaData = new Date(ultimoDeposito.created_at);
    const proximoDeposito = new Date(ultimaData.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() < proximoDeposito) {
      return NextResponse.json({ error: "limite_semanal", nextDepositAt: proximoDeposito.toISOString() }, { status: 400 });
    }
  }

  const { data: currentWallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  const currentBalance = currentWallet?.balance ?? 0;

  // Saldo entra integralmente na carteira (split físico entre conta custódia/operacional ocorre no gateway de pagamento)
  await supabase.from("wallets").update({ balance: currentBalance + amount }).eq("user_id", user.id);

  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount,
    net_amount: amount,
    description: `Depósito de Z$ ${amount.toFixed(2).replace(".", ",")}`,
  });

  // ── Bônus de referral — pagar Z$5 para ambos no primeiro depósito ──
  const { count: depositCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "deposit");

  const isPrimeiroDeposito = (depositCount ?? 0) === 1;

  if (isPrimeiroDeposito) {
    const { data: myProfile } = await supabase.from("profiles").select("referred_by").eq("id", user.id).single();

    if (myProfile?.referred_by) {
      const { data: referral } = await supabase
        .from("referrals")
        .select("id, status")
        .eq("referred_id", user.id)
        .eq("status", "pending")
        .single();

      if (referral) {
        const BONUS = 5;
        const { data: myWallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
        await supabase.from("wallets").update({ balance: (myWallet?.balance ?? 0) + BONUS }).eq("user_id", user.id);
        await supabase.from("transactions").insert({
          user_id: user.id, type: "referral_bonus", amount: BONUS, net_amount: BONUS,
          description: "Bônus de boas-vindas — indicado por amigo",
        });

        const { data: refWallet } = await supabase.from("wallets").select("balance").eq("user_id", myProfile.referred_by).single();
        await supabase.from("wallets").update({ balance: (refWallet?.balance ?? 0) + BONUS }).eq("user_id", myProfile.referred_by);
        await supabase.from("transactions").insert({
          user_id: myProfile.referred_by, type: "referral_bonus", amount: BONUS, net_amount: BONUS,
          description: "Bônus de referral — amigo fez primeiro depósito",
        });

        const referralBody = `Seu amigo fez o primeiro depósito. Z$ ${BONUS},00 creditados na sua carteira.`;
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

        await supabase.from("referrals").update({
          status: "completed",
          bonus_paid_at: new Date().toISOString(),
        }).eq("id", referral.id);
      }
    }
  }

  return NextResponse.json({ success: true, balance: currentBalance + amount, net_amount: amount });
}
