import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { creditBalance } from "@/lib/wallet";
import { isPremium } from "@/lib/premium";

// Bônus diário com sequência: base Z$10, +Z$5 por dia consecutivo, máx Z$40.
// Mesmo teto de carteira do bônus semanal (Z$1000 / Z$2000 Premium) para
// preservar a economia de Z$. Resgate no teto ainda mantém a sequência.
const BASE = 10;
const STEP = 5;
const MAX = 40;
const TETO = 1000;
const TETO_PREMIUM = 2000;

/** Data (YYYY-MM-DD) no fuso America/Sao_Paulo, com offset opcional em dias */
function spDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.now() + offsetDays * 86400000)
  );
}

function bonusForStreak(streak: number): number {
  return Math.min(BASE + (streak - 1) * STEP, MAX);
}

async function getState(userId: string) {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("daily_claims")
    .select("claimed_on, streak")
    .eq("user_id", userId)
    .order("claimed_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = spDate();
  const yesterday = spDate(-1);
  const claimedToday = last?.claimed_on === today;
  const currentStreak = claimedToday
    ? last.streak
    : last?.claimed_on === yesterday
      ? last.streak
      : 0;

  return {
    claimed_today: claimedToday,
    streak: currentStreak,
    // Z$ do resgate disponível agora (ou do próximo, se já resgatou hoje)
    claim_bonus: bonusForStreak(currentStreak + 1),
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  return NextResponse.json(await getState(user.id));
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const today = spDate();
  const yesterday = spDate(-1);

  const { data: last } = await admin
    .from("daily_claims")
    .select("claimed_on, streak")
    .eq("user_id", user.id)
    .order("claimed_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.claimed_on === today) {
    return NextResponse.json({ error: "Bônus de hoje já resgatado" }, { status: 409 });
  }

  const streak = last?.claimed_on === yesterday ? last.streak + 1 : 1;
  const bonus = bonusForStreak(streak);

  // Teto de carteira (mesma regra do bônus semanal)
  const [{ data: wallet }, { data: profile }] = await Promise.all([
    admin.from("wallets").select("balance").eq("user_id", user.id).single(),
    admin.from("profiles").select("is_premium, premium_until").eq("id", user.id).single(),
  ]);
  if (!wallet) return NextResponse.json({ error: "Carteira não encontrada" }, { status: 500 });

  const teto = isPremium(profile) ? TETO_PREMIUM : TETO;
  const actualBonus = Math.max(0, Math.min(bonus, teto - wallet.balance));

  // Insere o resgate primeiro — o UNIQUE (user_id, claimed_on) elimina corrida
  const { error: claimError } = await admin.from("daily_claims").insert({
    user_id: user.id,
    claimed_on: today,
    streak,
    bonus: actualBonus,
  });
  if (claimError) {
    return NextResponse.json({ error: "Bônus de hoje já resgatado" }, { status: 409 });
  }

  if (actualBonus > 0) {
    const credit = await creditBalance(admin, user.id, actualBonus);
    if (!credit.ok) {
      return NextResponse.json({ error: "Falha ao creditar bônus" }, { status: 500 });
    }
    await admin.from("transactions").insert({
      user_id: user.id,
      type: "daily_bonus",
      amount: actualBonus,
      net_amount: actualBonus,
      description: `Bônus diário — dia ${streak} da sequência`,
    });
  }

  return NextResponse.json({
    success: true,
    streak,
    bonus: actualBonus,
    at_ceiling: actualBonus === 0,
  });
}
