export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminQueue from "@/components/admin/AdminQueue";
import AdminResolve from "@/components/admin/AdminResolve";
import AdminCopaResolve from "@/components/admin/AdminCopaResolve";
import AdminStats from "@/components/admin/AdminStats";
import AdminActiveTopics from "@/components/admin/AdminActiveTopics";
import OracleLog from "@/components/admin/OracleLog";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/liga");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  // Usuários órfãos: auth.users sem perfil correspondente
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: profileIds } = await admin.from("profiles").select("id");
  const profileIdSet = new Set((profileIds ?? []).map((p: any) => p.id));
  const orphanedUsers = authUsers.filter((u) => !profileIdSet.has(u.id));

  // Concurso ativo + participantes inscritos
  const { data: concursoAtivo } = await admin
    .from("concursos")
    .select("id, titulo, periodo_inicio, periodo_fim")
    .eq("status", "ativo")
    .order("periodo_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  let concursoParticipantes: any[] = [];
  if (concursoAtivo) {
    // Em produção a FK inscricoes_concurso.user_id aponta para auth.users (não
    // profiles), então não dá pra usar embed PostgREST — buscamos profiles à parte.
    const [{ data: inscricoes }, { data: concursoWallets }] = await Promise.all([
      admin.from("inscricoes_concurso")
        .select("created_at, user_id")
        .eq("concurso_id", concursoAtivo.id)
        .order("created_at", { ascending: false }),
      admin.from("concurso_wallets")
        .select("user_id, balance")
        .eq("concurso_id", concursoAtivo.id),
    ]);
    const userIds = (inscricoes ?? []).map((i: any) => i.user_id);
    const { data: profs } = userIds.length
      ? await admin.from("profiles").select("id, username, full_name, cpf").in("id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const balanceMap = new Map((concursoWallets ?? []).map((w: any) => [w.user_id, w.balance]));
    concursoParticipantes = (inscricoes ?? []).map((i: any) => ({
      ...i,
      profile: profMap.get(i.user_id) ?? null,
      saldo_atual: balanceMap.get(i.user_id) ?? null,
    }));
  }

  // SEPARAR: Econômico vs Liga vs Concurso (separar em JS após buscar todos os ativos)
  const [
    { data: pending },
    { data: allResolving },
    { data: wallets },
    { data: activeBets },
    { data: openOrders },
    { data: allActiveTopics },
    { count: totalUsers },
    { count: newUsersWeek },
    { count: totalBets },
    { data: totalVolumeData },
    { data: activeBettors30dRaw },
  ] = await Promise.all([
    admin.from("topics").select("*, creator:profiles!creator_id(username, full_name)").eq("status", "pending").order("created_at"),
    // Todos resolving — admin pode resolver manualmente qualquer um
    admin.from("topics").select("id, title, category, closes_at, oracle_retry_count, market_type").eq("status", "resolving").eq("is_private", false).order("closes_at"),
    admin.from("wallets").select("balance"),
    admin.from("bets").select("amount").in("status", ["pending", "matched", "partial"]),
    admin.from("orders").select("price, quantity, filled_qty").eq("status", "open").eq("side", "buy"),
    // Buscar todos os ativos - separar em JS depois
    admin.from("topics").select("id, title, category, closes_at, created_at, concurso_id").eq("status", "active").order("closes_at"),
    // Stats de usuários
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("bets").select("*", { count: "exact", head: true }),
    admin.from("bets").select("amount").in("status", ["matched", "won", "lost"]),
    // "Ativos (30 dias)" = usuários distintos com pelo menos 1 palpite nos últimos
    // 30 dias. `profiles.updated_at` não existe (a query antiga retornava lixo);
    // sem instrumentação de last_seen, atividade de aposta é o melhor proxy real.
    admin.from("bets").select("user_id").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const activeUsers30d = new Set((activeBettors30dRaw ?? []).map((b: any) => b.user_id)).size;

  // Buscar outcomes para topics resolving que são multi
  const multiResolvingIds = (allResolving ?? []).filter((t: any) => t.market_type === "multi").map((t: any) => t.id);
  let outcomesMap: Record<string, { id: string; label: string }[]> = {};
  if (multiResolvingIds.length > 0) {
    const { data: allOutcomes } = await admin.from("topic_outcomes").select("id, topic_id, label, position").in("topic_id", multiResolvingIds).order("position");
    for (const o of allOutcomes ?? []) {
      if (!outcomesMap[o.topic_id]) outcomesMap[o.topic_id] = [];
      outcomesMap[o.topic_id].push({ id: o.id, label: o.label });
    }
  }
  const resolvingWithOutcomes = (allResolving ?? []).map((t: any) => ({
    ...t,
    outcomes: outcomesMap[t.id] ?? [],
  }));

  // Separar em JS (funciona com ou sem coluna concurso_id no banco)
  const ligaTopics = (allActiveTopics ?? []).filter(t => !t.concurso_id);
  const concursoTopics = (allActiveTopics ?? []).filter(t => t.concurso_id);

  // Copa: partidas já disputadas que o oráculo não fechou (manual). Inclui as
  // em revisão e as ainda agendadas/adiadas cujo kickoff já passou.
  const { data: copaMatchesRaw } = await admin
    .from("copa_matches")
    .select("*")
    .in("status", ["scheduled", "postponed", "under_review"])
    .lt("kickoff_at", new Date().toISOString())
    .not("home_team", "is", null)
    .not("away_team", "is", null)
    .order("kickoff_at", { ascending: true });
  const copaMatchesDue = copaMatchesRaw ?? [];

  const walletBalance  = (wallets ?? []).reduce((s, w: any) => s + (w.balance ?? 0), 0);
  const betsLocked     = (activeBets ?? []).reduce((s, b: any) => s + (b.amount ?? 0), 0);
  const ordersEscrow   = (openOrders ?? []).reduce((s, o: any) => s + parseFloat(o.price) * (parseFloat(o.quantity) - parseFloat(o.filled_qty ?? 0)), 0);
  const passiveTotal   = walletBalance + betsLocked + ordersEscrow;
  const volumeTotal    = (totalVolumeData ?? []).reduce((s, b: any) => s + (b.amount ?? 0), 0);

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
        pendingCount={pending?.length ?? 0}
        toResolveCount={allResolving?.length ?? 0}
        totalUsers={totalUsers ?? 0}
        newUsersWeek={newUsersWeek ?? 0}
        totalBets={totalBets ?? 0}
        volumeTotal={volumeTotal}
        activeUsers30d={activeUsers30d ?? 0}
      />
      <AdminQueue topics={pending ?? []} />
      <AdminResolve topics={[]} allResolving={resolvingWithOutcomes} />
      <AdminCopaResolve matches={copaMatchesDue} />

      {/* Liga */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Liga (Eventos Gerais)</h2>
        <p className="text-xs text-muted-foreground mb-3">Eventos que NÃO são econômicos (esportes, política, tecnologia, entretenimento)</p>
        <AdminActiveTopics topics={ligaTopics ?? []} showCategory />
      </div>

      {/* Concurso - Com concurso_id */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Concurso (Eventos com Inscrição)</h2>
        <p className="text-xs text-muted-foreground mb-3">Eventos que fazem parte do concurso ativo (min_bet = 20 Z$)</p>
        <AdminActiveTopics topics={concursoTopics ?? []} showCategory showConcurso />
      </div>

      {/* Participantes do Concurso */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Participantes do Concurso</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {concursoAtivo
            ? `Inscritos no concurso ativo "${concursoAtivo.titulo}"`
            : "Nenhum concurso ativo no momento"}
        </p>
        {!concursoAtivo ? null : concursoParticipantes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
            Nenhum usuário inscrito neste concurso ainda.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              <span className="text-sm font-semibold text-primary">
                {concursoParticipantes.length} participante(s)
              </span>
            </div>
            <div className="divide-y divide-border">
              {concursoParticipantes.map((p: any, i: number) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {p.profile?.full_name ?? "—"}
                      {p.profile?.username ? <span className="text-muted-foreground font-normal"> @{p.profile.username}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{p.profile?.cpf ?? "sem CPF"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.saldo_atual != null ? <p className="text-xs text-white">{Number(p.saldo_atual).toFixed(2)} ZC$</p> : null}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saúde do Sistema */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Saúde do Sistema</h2>
        <p className="text-xs text-muted-foreground mb-3">Usuários órfãos — criaram conta mas não têm perfil</p>
        {orphanedUsers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-sim flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sim inline-block" />
            Nenhum usuário órfão encontrado. Trigger funcionando corretamente.
          </div>
        ) : (
          <div className="bg-card border border-yellow-500/30 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              <span className="text-sm font-semibold text-yellow-400">{orphanedUsers.length} usuário(s) sem perfil</span>
            </div>
            <div className="divide-y divide-border">
              {orphanedUsers.map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u.id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-yellow-400 mt-0.5">{u.email_confirmed_at ? "email confirmado" : "email não confirmado"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-3">Resoluções Oracle</h2>
        <OracleLog />
      </div>
    </div>
  );
}
