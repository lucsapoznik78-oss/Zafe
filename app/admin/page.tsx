export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminQueue from "@/components/admin/AdminQueue";
import AdminResolve from "@/components/admin/AdminResolve";
import AdminStats from "@/components/admin/AdminStats";
import AdminActiveTopics from "@/components/admin/AdminActiveTopics";
import OracleLog from "@/components/admin/OracleLog";
import RelatorioFinanceiro from "@/components/admin/RelatorioFinanceiro";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/liga");

  // Todos os DB calls usam adminSupabase — RLS bloquearia a maioria das queries
  const admin = createAdminClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: pending },
    { data: allResolving },
    { data: wallets },
    { data: activeBets },
    { data: openOrders },
    { data: commissionTxs },
    { data: activeTopics },
    { count: totalUsers },
    { count: newUsersWeek },
    { count: totalBets },
    { data: totalVolumeData },
    { count: activeUsers30d },
  ] = await Promise.all([
    admin.from("topics").select("*, creator:profiles!creator_id(username, full_name)").eq("status", "pending").order("created_at"),
    // Todos resolving — admin pode resolver manualmente qualquer um
    admin.from("topics").select("id, title, category, closes_at, oracle_retry_count").eq("status", "resolving").eq("is_private", false).order("closes_at"),
    admin.from("wallets").select("balance"),
    admin.from("bets").select("amount").in("status", ["pending", "matched", "partial"]),
    admin.from("orders").select("price, quantity, filled_qty").eq("status", "open").eq("side", "buy"),
    admin.from("transactions").select("net_amount").eq("type", "commission"),
    admin.from("topics").select("id, title, category, closes_at").eq("status", "active").eq("is_private", false).order("closes_at"),
    // Stats de usuários
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("bets").select("*", { count: "exact", head: true }),
    admin.from("bets").select("amount").in("status", ["matched", "won", "lost"]),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const walletBalance  = (wallets ?? []).reduce((s, w: any) => s + (w.balance ?? 0), 0);
  const betsLocked     = (activeBets ?? []).reduce((s, b: any) => s + (b.amount ?? 0), 0);
  const ordersEscrow   = (openOrders ?? []).reduce((s, o: any) => s + parseFloat(o.price) * (parseFloat(o.quantity) - parseFloat(o.filled_qty ?? 0)), 0);
  const commission     = (commissionTxs ?? []).reduce((s, t: any) => s + (t.net_amount ?? 0), 0);
  const passiveTotal   = walletBalance + betsLocked + ordersEscrow;
  const volumeTotal    = (totalVolumeData ?? []).reduce((s, b: any) => s + (b.amount ?? 0), 0);

  const seenTitles = new Set<string>();
  const uniqueActiveTopics = (activeTopics ?? []).filter((t) => {
    if (seenTitles.has(t.title)) return false;
    seenTitles.add(t.title);
    return true;
  });

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
          <p className="text-muted-foreground text-sm">Gerencie setores e acompanhe previsões</p>
        </div>
        <span className="ml-auto px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded">ADMIN</span>
      </div>

      <AdminStats
        passiveTotal={passiveTotal}
        walletBalance={walletBalance}
        betsLocked={betsLocked}
        commission={commission}
        pendingCount={pending?.length ?? 0}
        toResolveCount={allResolving?.length ?? 0}
        totalUsers={totalUsers ?? 0}
        newUsersWeek={newUsersWeek ?? 0}
        totalBets={totalBets ?? 0}
        volumeTotal={volumeTotal}
        activeUsers30d={activeUsers30d ?? 0}
      />
      <AdminQueue topics={pending ?? []} />
      <AdminResolve topics={[]} allResolving={allResolving ?? []} />
      <AdminActiveTopics topics={uniqueActiveTopics} />

      <div>
        <h2 className="text-lg font-bold text-white mb-3">Resoluções Oracle</h2>
        <OracleLog />
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-1">Relatório Financeiro</h2>
        <p className="text-xs text-muted-foreground mb-3">Separação contábil: receita própria vs volume custodiado</p>
        <RelatorioFinanceiro />
      </div>
    </div>
  );
}
