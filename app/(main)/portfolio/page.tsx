export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { TrendingUp, TrendingDown, Trophy, Clock, Eye } from "lucide-react";

function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default async function PortfolioPage() {
  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: activeBets },
    { data: resolvedBets },
    { data: openOrders },
    { data: wallet },
    { data: watchlistItems },
  ] = await Promise.all([
    // Apostas ativas
    admin.from("bets")
      .select("id, topic_id, side, amount, locked_odds, status, potential_payout, order_id")
      .eq("user_id", user.id)
      .in("status", ["pending", "matched", "partial"])
      .order("topic_id"),

    // Apostas resolvidas (para P&L realizado)
    admin.from("bets")
      .select("id, topic_id, side, amount, potential_payout, status")
      .eq("user_id", user.id)
      .in("status", ["won", "lost", "refunded"])
      .order("topic_id"),

    // Ordens abertas no secundário
    admin.from("orders")
      .select("id, topic_id, side, order_type, price, quantity, filled_qty, status")
      .eq("user_id", user.id)
      .in("status", ["open", "partial"]),

    // Saldo
    supabase.from("wallets").select("balance").eq("user_id", user.id).single(),

    // Watchlist
    admin.from("watchlist")
      .select("topic_id, threshold_pct")
      .eq("user_id", user.id)
      .not("topic_id", "is", null),
  ]);

  // Buscar tópicos únicos de todas as fontes
  const allTopicIds = [...new Set([
    ...(activeBets ?? []).map((b: any) => b.topic_id),
    ...(resolvedBets ?? []).map((b: any) => b.topic_id),
    ...(openOrders ?? []).map((o: any) => o.topic_id),
    ...(watchlistItems ?? []).map((w: any) => w.topic_id).filter(Boolean),
  ])];

  const [{ data: topics }, { data: statsData }] = allTopicIds.length
    ? await Promise.all([
        admin.from("topics").select("id, title, category, status, closes_at, resolution").in("id", allTopicIds),
        admin.from("v_topic_stats").select("topic_id, prob_sim").in("topic_id", allTopicIds),
      ])
    : [{ data: [] }, { data: [] }];

  const topicMap = new Map((topics ?? []).map((t: any) => [t.id, t]));
  const probMap  = new Map((statsData ?? []).map((s: any) => [s.topic_id, parseFloat(s.prob_sim ?? "0.5")]));

  // ── P&L Realizado ──────────────────────────────────────────────
  let realizedPnl = 0;
  let totalWon = 0;
  let totalLost = 0;
  for (const b of resolvedBets ?? []) {
    const amt = parseFloat(b.amount);
    if (b.status === "won") {
      const payout = parseFloat(b.potential_payout ?? "0");
      realizedPnl += payout - amt;
      totalWon++;
    } else if (b.status === "lost") {
      realizedPnl -= amt;
      totalLost++;
    }
  }

  // ── Posições ativas agrupadas por tópico ───────────────────────
  const activeBetsByTopic = new Map<string, any[]>();
  for (const b of activeBets ?? []) {
    const arr = activeBetsByTopic.get(b.topic_id) ?? [];
    arr.push(b);
    activeBetsByTopic.set(b.topic_id, arr);
  }
  const ordersByTopic = new Map<string, any[]>();
  for (const o of openOrders ?? []) {
    const arr = ordersByTopic.get(o.topic_id) ?? [];
    arr.push(o);
    ordersByTopic.set(o.topic_id, arr);
  }

  const activeTopicIds = [...new Set([
    ...(activeBets ?? []).map((b: any) => b.topic_id),
    ...(openOrders ?? []).map((o: any) => o.topic_id),
  ])];

  // P&L não realizado (estimativa pelo valor de mercado atual)
  let unrealizedPnl = 0;
  let totalInvested = 0;
  for (const topicId of activeTopicIds) {
    const bets = activeBetsByTopic.get(topicId) ?? [];
    const probSim = probMap.get(topicId) ?? 0.5;
    for (const b of bets) {
      const amt = parseFloat(b.amount);
      const entryProb = b.locked_odds > 0 ? 1 / parseFloat(b.locked_odds) : 0.5;
      const currentProb = b.side === "sim" ? probSim : 1 - probSim;
      const currentValue = amt * (currentProb / entryProb);
      unrealizedPnl += currentValue - amt;
      totalInvested += amt;
    }
  }

  const watchlistSet = new Set((watchlistItems ?? []).map((w: any) => w.topic_id));
  const watchlistOnlyTopics = (watchlistItems ?? [])
    .filter((w: any) => !activeTopicIds.includes(w.topic_id))
    .map((w: any) => ({ ...w, topic: topicMap.get(w.topic_id) }))
    .filter((w: any) => w.topic && w.topic.status === "active");

  const pnlColor = (v: number) => v >= 0 ? "text-sim" : "text-nao";
  const pnlSign  = (v: number) => v >= 0 ? "+" : "";

  return (
    <div className="py-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Portfólio</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Suas posições e histórico de resultados</p>
      </div>

      {/* Resumo P&L */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Saldo atual</p>
          <p className="text-lg font-bold text-white">{formatCurrency(wallet?.balance ?? 0)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Investido (ativo)</p>
          <p className="text-lg font-bold text-white">{formatCurrency(totalInvested)}</p>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${unrealizedPnl >= 0 ? "border-sim/30" : "border-nao/30"}`}>
          <p className="text-xs text-muted-foreground mb-1">P&L não realizado</p>
          <p className={`text-lg font-bold ${pnlColor(unrealizedPnl)}`}>
            {pnlSign(unrealizedPnl)}{formatCurrency(unrealizedPnl)}
          </p>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${realizedPnl >= 0 ? "border-sim/30" : "border-nao/30"}`}>
          <p className="text-xs text-muted-foreground mb-1">P&L realizado</p>
          <p className={`text-lg font-bold ${pnlColor(realizedPnl)}`}>
            {pnlSign(realizedPnl)}{formatCurrency(realizedPnl)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{totalWon}W · {totalLost}L</p>
        </div>
      </div>

      {/* Posições ativas */}
      {activeTopicIds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Posições ativas</h2>
          <div className="space-y-3">
            {activeTopicIds.map(topicId => {
              const topic = topicMap.get(topicId);
              if (!topic) return null;
              const probSim = probMap.get(topicId) ?? 0.5;
              const bets = activeBetsByTopic.get(topicId) ?? [];
              const orders = ordersByTopic.get(topicId) ?? [];

              const buildPos = (side: "sim" | "nao") => {
                const sideBets = bets.filter((b: any) => b.side === side);
                if (!sideBets.length) return null;
                const totalAmt = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
                const weightedEntry = sideBets.reduce((s: number, b: any) =>
                  s + (1 / parseFloat(b.locked_odds)) * parseFloat(b.amount), 0) / totalAmt;
                const currentProb = side === "sim" ? probSim : 1 - probSim;
                const currentValue = totalAmt * (currentProb / weightedEntry);
                const pnl = currentValue - totalAmt;
                const pnlPct = (pnl / totalAmt) * 100;
                const maxPayout = sideBets.reduce((s: number, b: any) => s + parseFloat(b.potential_payout ?? "0"), 0);
                return { totalAmt, weightedEntry, currentProb, currentValue, pnl, pnlPct, maxPayout };
              };

              const simPos = buildPos("sim");
              const naoPos = buildPos("nao");

              return (
                <div key={topicId} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CategoryBadge category={topic.category} />
                      <Link href={`/topicos/${topicId}`} className="block text-sm font-semibold text-white hover:text-primary transition-colors line-clamp-2">
                        {topic.title}
                      </Link>
                    </div>
                    {topic.closes_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(topic.closes_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>

                  {[simPos && { pos: simPos, side: "sim" as const }, naoPos && { pos: naoPos, side: "nao" as const }]
                    .filter(Boolean)
                    .map(({ pos, side }: any) => {
                      const positive = pos.pnl >= 0;
                      const color = side === "sim" ? "text-sim" : "text-nao";
                      const bg    = side === "sim" ? "bg-sim/5 border-sim/20" : "bg-nao/5 border-nao/20";
                      return (
                        <div key={side} className={`rounded-lg border p-3 ${bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold ${color}`}>{side.toUpperCase()}</span>
                            <span className={`text-xs font-semibold flex items-center gap-1 ${positive ? "text-sim" : "text-nao"}`}>
                              {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {positive ? "+" : ""}{pos.pnlPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                            <span className="text-muted-foreground">Investido</span>
                            <span className="text-right text-white">{formatCurrency(pos.totalAmt)}</span>
                            <span className="text-muted-foreground">Entrada</span>
                            <span className="text-right text-white">{fmtPct(pos.weightedEntry)}</span>
                            <span className="text-muted-foreground">Atual</span>
                            <span className="text-right text-white">{fmtPct(pos.currentProb)}</span>
                            <span className="text-muted-foreground">Se ganhar</span>
                            <span className={`text-right font-semibold ${positive ? "text-sim" : "text-muted-foreground"}`}>
                              +{formatCurrency(pos.maxPayout - pos.totalAmt)}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Apostou {side.toUpperCase()} a {fmtPct(pos.weightedEntry)} — hoje está em {fmtPct(pos.currentProb)} — {positive ? "+" : ""}{formatCurrency(pos.pnl)} valor de mercado
                          </p>
                        </div>
                      );
                    })}

                  {orders.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase">Ordens abertas</p>
                      {orders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${o.side === "sim" ? "text-sim" : "text-nao"}`}>
                            {o.side.toUpperCase()} {o.order_type === "buy" ? "COMPRA" : "VENDA"}
                          </span>
                          <span className="text-muted-foreground">
                            {fmtPct(parseFloat(o.price))} · {formatCurrency(parseFloat(o.quantity) - parseFloat(o.filled_qty ?? "0"))} restante
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Watchlist (sem aposta) */}
      {watchlistOnlyTopics.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Eye size={15} className="text-muted-foreground" />
            Seguindo (sem posição)
          </h2>
          <div className="space-y-2">
            {watchlistOnlyTopics.map(({ topic, threshold_pct }: any) => {
              const probSim = probMap.get(topic.id) ?? 0.5;
              return (
                <div key={topic.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/topicos/${topic.id}`} className="text-sm font-medium text-white hover:text-primary transition-colors line-clamp-1">
                      {topic.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      SIM {fmtPct(probSim)} · Alerta ≥{threshold_pct}% variação
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-white">{fmtPct(probSim)}</span>
                    <Link href={`/topicos/${topic.id}`} className="px-2.5 py-1 bg-primary text-black text-xs font-bold rounded-lg hover:bg-primary/90">
                      Apostar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Histórico */}
      {(resolvedBets ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Trophy size={15} className="text-muted-foreground" />
            Histórico de apostas
          </h2>
          <div className="space-y-2">
            {(resolvedBets ?? []).slice(0, 20).map((b: any) => {
              const topic = topicMap.get(b.topic_id);
              const amt = parseFloat(b.amount);
              const payout = parseFloat(b.potential_payout ?? "0");
              const pnl = b.status === "won" ? payout - amt : b.status === "lost" ? -amt : 0;
              const positive = pnl >= 0;
              return (
                <div key={b.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={topic ? `/topicos/${b.topic_id}` : "#"} className="text-sm font-medium text-white hover:text-primary transition-colors line-clamp-1">
                      {topic?.title ?? "Mercado removido"}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {b.side.toUpperCase()} · {formatCurrency(amt)} apostado
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${b.status === "won" ? "text-sim" : b.status === "lost" ? "text-nao" : "text-muted-foreground"}`}>
                      {b.status === "won" ? "+" : b.status === "lost" ? "-" : ""}{b.status === "refunded" ? "Reembolso" : formatCurrency(Math.abs(pnl))}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">{b.status === "won" ? "Ganhou" : b.status === "lost" ? "Perdeu" : "Reembolso"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTopicIds.length === 0 && (resolvedBets ?? []).length === 0 && watchlistOnlyTopics.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white font-medium mb-1">Nenhuma posição ainda</p>
          <p className="text-muted-foreground text-sm">Explore os mercados e faça sua primeira aposta</p>
          <Link href="/topicos" className="inline-block mt-4 px-5 py-2.5 bg-primary text-black font-semibold rounded-lg text-sm">
            Explorar mercados
          </Link>
        </div>
      )}
    </div>
  );
}
