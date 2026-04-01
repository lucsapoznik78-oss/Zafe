export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminQueue from "@/components/admin/AdminQueue";
import AdminResolve from "@/components/admin/AdminResolve";
import AdminStats from "@/components/admin/AdminStats";
import OracleLog from "@/components/admin/OracleLog";
import RelatorioFinanceiro from "@/components/admin/RelatorioFinanceiro";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/topicos");

  const adminSupabase = createAdminClient();

  const [{ data: pending }, { data: toResolve }, { data: statsData }] = await Promise.all([
    supabase.from("topics").select("*, creator:profiles!creator_id(username, full_name)").eq("status", "pending").order("created_at"),
    // Apenas mercados sinalizados para revisão manual (contradição entre API e IA)
    supabase
      .from("topics")
      .select(`id, title, category, resolucoes!inner(id, resultado_final, oracle_usado, resolvido_por, created_at)`)
      .eq("status", "resolving")
      .eq("resolucoes.resultado_final", "SINALIZADO_REVISAO")
      .order("created_at", { ascending: true }),
    // Use service role to bypass RLS and get all wallets
    adminSupabase.from("wallets").select("balance"),
  ]);

  const totalBalance = (statsData ?? []).reduce((sum: number, w: { balance: number }) => sum + (w.balance ?? 0), 0);

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
          <p className="text-muted-foreground text-sm">Gerencie tópicos e resolva mercados</p>
        </div>
        <span className="ml-auto px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded">ADMIN</span>
      </div>

      <AdminStats totalCommission={totalBalance} pendingCount={pending?.length ?? 0} toResolveCount={toResolve?.length ?? 0} />
      <AdminQueue topics={pending ?? []} />
      <AdminResolve topics={toResolve ?? []} />

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
