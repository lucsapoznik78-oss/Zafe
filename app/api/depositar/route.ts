import { createClient, createAdminClient } from "@/lib/supabase/server";
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
    const proximoDeposito = new Date(new Date(ultimoDeposito.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() < proximoDeposito) {
      return NextResponse.json({ error: "limite_semanal", nextDepositAt: proximoDeposito.toISOString() }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  // Atomic balance update — evita race condition read-modify-write
  const { data: newBalance, error: walletErr } = await admin.rpc("add_to_balance", {
    p_user_id: user.id,
    p_amount: amount,
  });
  if (walletErr) return NextResponse.json({ error: "Erro ao creditar saldo" }, { status: 500 });

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "deposit",
    amount,
    net_amount: amount,
    description: `Depósito de Z$ ${amount.toFixed(2).replace(".", ",")}`,
  });

  // ── Bônus de referral — pagar Z$5 para ambos no primeiro depósito ──
  // Conta depósitos APÓS inserir — se for 1, é o primeiro
  const { count: depositCount } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", "deposit");

  if ((depositCount ?? 0) === 1) {
    const { data: myProfile } = await admin.from("profiles").select("referred_by").eq("id", user.id).single();

    if (myProfile?.referred_by) {
      // Atomic claim: só processa se conseguir mudar de pending → completed
      // Usa update com filtro em status para evitar duplo pagamento
      const { data: claimedReferrals } = await admin
        .from("referrals")
        .update({ status: "completed", bonus_paid_at: new Date().toISOString() })
        .eq("referred_id", user.id)
        .eq("status", "pending")
        .select("id");

      if (claimedReferrals && claimedReferrals.length > 0) {
        const BONUS = 5;

        // Ambos os créditos são atômicos via RPC
        await Promise.all([
          admin.rpc("add_to_balance", { p_user_id: user.id, p_amount: BONUS }),
          admin.rpc("add_to_balance", { p_user_id: myProfile.referred_by, p_amount: BONUS }),
          admin.from("transactions").insert([
            { user_id: user.id, type: "referral_bonus", amount: BONUS, net_amount: BONUS, description: "Bônus de boas-vindas — indicado por amigo" },
            { user_id: myProfile.referred_by, type: "referral_bonus", amount: BONUS, net_amount: BONUS, description: "Bônus de referral — amigo fez primeiro depósito" },
          ]),
          admin.from("notifications").insert({
            user_id: myProfile.referred_by, type: "market_resolved",
            title: "Bônus de referral! 🎉",
            body: `Seu amigo fez o primeiro depósito. Z$ ${BONUS},00 creditados na sua carteira.`,
          }),
        ]);

        sendPushToUser(admin, myProfile.referred_by, {
          title: "Bônus de referral! 🎉",
          body: `Seu amigo fez o primeiro depósito. Z$ ${BONUS},00 creditados.`,
          url: "/perfil",
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ success: true, balance: newBalance, net_amount: amount });
}
