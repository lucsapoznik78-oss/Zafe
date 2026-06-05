import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { creditBalance } from "@/lib/wallet";

const BONUS = 100;
const TETO = 1000;

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

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
    const actualBonus = Math.min(BONUS, TETO - wallet.balance);

    await creditBalance(supabase, wallet.user_id, actualBonus);
    await supabase.from("transactions").insert({
      user_id: wallet.user_id,
      type: "weekly_bonus",
      amount: actualBonus,
      net_amount: actualBonus,
      description: `Bônus semanal Zafe — Z$ ${actualBonus.toFixed(2).replace(".", ",")}`,
    });
    await supabase.from("notifications").insert({
      user_id: wallet.user_id,
      type: "market_resolved",
      title: "Bônus semanal! 🎁",
      body: `Z$ ${actualBonus.toFixed(2).replace(".", ",")} creditados no seu saldo.`,
    });

    credited++;
  }

  return NextResponse.json({ success: true, credited, skipped });
}
