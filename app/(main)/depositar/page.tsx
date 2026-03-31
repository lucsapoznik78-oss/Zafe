export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DepositSection from "@/components/carteira/DepositSection";
import TransactionHistory from "@/components/carteira/TransactionHistory";

export default async function DepositarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: wallet }, { data: transactions }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carteira</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie seu saldo e transações</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Saldo disponível</p>
        <p className="text-4xl font-bold text-primary">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(wallet?.balance ?? 0)}
        </p>
      </div>

      <DepositSection currentBalance={wallet?.balance ?? 0} />
      <TransactionHistory transactions={transactions ?? []} />
    </div>
  );
}
