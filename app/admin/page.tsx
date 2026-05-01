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
  if (!profile?.is_admin) redirect("/topicos");

  const adminSupabase = createAdminClient();

  const [
    { data: pending },
    { data: toResolve },
    { data: allResolving },
    { data: wallets },
    { data: activeBets },
    { data: openOrders },
    { data: commissionTxs },
    { data: activeTopics },
  ] = await Promise.all([
    supabase.from("topics").select("*, creator:profiles!creator_id(username, full_name)").eq("status", "pending").order("created_at"),
    supabase
      .from("topics")
      .select(`id, title, category, resolucoes!inner(id, resultado_final, oracle_usado, resolvido_por, created_at)`)
      .eq("status", "resolving")
      .eq("resolucoes.resultado_final", "SINALIZADO_REVISAO")
      .order("created_at", { ascending: true }),
    // TODOS os resolving (para admin resolver manualmente se oracle falhar)
    adminSupabase
      .from("topics")
      .select("id, title, category, closes_at, oracle_retry_count")
      .eq("status", "resolving")
      .eq("is_private", false)
      .order("closes_at"),
    // Saldo disponível em carteiras
    adminSupabase.from("wallets").select("balance"),
    // Dinheiro bloqueado em apostas ativas
    adminSupabase.from("bets").select("amount").in("status", ["pending", "matched", "partial"]),
    // Dinheiro bloqueado em ordens de compra abertas (escrow)
    adminSupabase.from("orders").select("price, quantity, filled_qty").eq("status", "open").eq("side", "buy"),
    // Comissões acumuladas (receita da plataforma)
    adminSupabase.from("transactions").select("net_amount").eq("type", "commission"),
    // Mercados ativos para edição de prazo
    adminSupabase.from("topics").select("id, title, category, closes_at").eq("status", "active").eq("is_private", false).order("closes_at"),
  ]);

  const walletBalance  = (wallets ?? []).reduce((s, w: { balance: number }) => s + (w.balance ?? 0), 0);
  const betsLocked     = (activeBets ?? []).reduce((s, b: { amount: number }) => s + (b.amount ?? 0), 0);
  const ordersEscrow   = (openOrders ?? []).reduce((s, o: any) => s + parseFloat(o.price) * (parseFloat(o.quantity) - parseFloat(o.filled_qty ?? 0)), 0);
  const commission     = (commissionTxs ?? []).reduce((s, t: { net_amount: number }) => s + (t.net_amount ?? 0), 0);
  // Passivo total = tudo que a plataforma deve aos usuários (carteiras + apostas em andamento + ordens)
  const passiveTotal   = walletBalance + betsLocked + ordersEscrow;

  // Deduplicate active topics by title (keep first/earliest closes_at)
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
          <p className="text-muted-foreground text-sm">Gerencie tópicos e resolva mercados</p>
        </div>
        <span className="ml-auto px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded">ADMIN</span>
      </div>

      <AdminStats
        passiveTotal={passiveTotal}
        walletBalance={walletBalance}
        betsLocked={betsLocked}
        commission={commission}
        pendingCount={pending?.length ?? 0}
        toResolveCount={toResolve?.length ?? 0}
      />
      <AdminQueue topics={pending ?? []} />
      <AdminResolve topics={toResolve ?? []} allResolving={allResolving ?? []} />
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
