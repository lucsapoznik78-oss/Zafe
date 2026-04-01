import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BONUS = 200;
const TETO = 1000;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = false;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else {
    // Allow admin calling manually
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      authorized = profile?.is_admin === true;
    }
  }

  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const supabase = createAdminClient();

  // Get all wallets
  const { data: wallets } = await supabase.from("wallets").select("user_id, balance");
  if (!wallets) return NextResponse.json({ error: "Falha ao buscar carteiras" }, { status: 500 });

  let credited = 0;
  let skipped = 0;

  for (const wallet of wallets) {
    if (wallet.balance >= TETO) {
      skipped++;
      continue;
    }
    const newBalance = Math.min(wallet.balance + BONUS, TETO);
    const actualBonus = newBalance - wallet.balance;

    await supabase.from("wallets").update({ balance: newBalance }).eq("user_id", wallet.user_id);
    await supabase.from("transactions").insert({
      user_id: wallet.user_id,
      type: "referral_bonus",
      amount: actualBonus,
      net_amount: actualBonus,
      description: `Bônus semanal Zafe — Z$ ${actualBonus.toFixed(2).replace(".", ",")}`,
    });
    await supabase.from("notifications").insert({
      user_id: wallet.user_id,
      type: "market_resolved",
      title: "Bônus semanal! 🎁",
      body: `Z$ ${actualBonus.toFixed(2).replace(".", ",")} creditados na sua carteira.`,
    });

    credited++;
  }

  return NextResponse.json({ success: true, credited, skipped });
}
