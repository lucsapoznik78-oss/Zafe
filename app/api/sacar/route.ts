import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SAQUE_MINIMO } from "@/lib/financeiro";
// Leia lib/financeiro.ts para entender a separação de contas antes de integrar pagamento.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { amount } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  if (amount < SAQUE_MINIMO) {
    return NextResponse.json(
      { error: `Valor mínimo de saque é ${"Z$ " + new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(SAQUE_MINIMO)}` },
      { status: 400 }
    );
  }

  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < amount) return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });

  await supabase.from("wallets").update({ balance: wallet.balance - amount }).eq("user_id", user.id);

  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "withdraw",
    amount,
    net_amount: amount,
    description: `Saque de ${"Z$ " + new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(amount)}`,
    // account: CONTA_CUSTODIA — o saque SEMPRE sai da conta custódia, nunca da operacional
    // Ver: lib/financeiro.ts → CONTA_CUSTODIA
  });

  return NextResponse.json({ success: true });
}
