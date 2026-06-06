export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

function fmt(n: number) { return `Z$ ${n.toFixed(2)}`; }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default async function MinhasPosicoes() {
  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Apostas ativas (primário + secundário)
  const { data: bets } = await admin
    .from("bets")
    .select("id, topic_id, side, amount, locked_odds, status, potential_payout")
    .eq("user_id", user.id)
    .in("status", ["pending", "matched", "partial"])
    .order("topic_id");

  // Apostas já resolvidas (ganhou / perdeu / reembolsada)
  const { data: resolvedBets } = await admin
    .from("bets")
    .select("id, topic_id, side, amount, status, potential_payout")
    .eq("user_id", user.id)
    .in("status", ["won", "lost", "refunded"])
    .order("topic_id");

  // Ordens abertas no secundário
  const { data: orders } = await admin
    .from("orders")
    .select("id, topic_id, side, order_type, price, quantity, filled_qty, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false });

  // Buscar tópicos únicos (ativos + resolvidos)
  const activeTopicIds = [...new Set([
    ...(bets ?? []).map((b: any) => b.topic_id),
    ...(orders ?? []).map((o: any) => o.topic_id),
  ])];
  const resolvedTopicIds = [...new Set((resolvedBets ?? []).map((b: any) => b.topic_id))];
  const topicIds = [...new Set([...activeTopicIds, ...resolvedTopicIds])];

  const [{ data: topics }, { data: statsData }] = topicIds.length
    ? await Promise.all([
        admin.from("topics").select("id, title, category, status, closes_at, resolution, resolved_at").in("id", topicIds),
        admin.from("v_topic_stats").select("topic_id, prob_sim").in("topic_id", activeTopicIds.length ? activeTopicIds : ["_"]),
      ])
    : [{ data: [] }, { data: [] }];

  const topicMap  = new Map((topics ?? []).map((t: any) => [t.id, t]));
  const probMap   = new Map((statsData ?? []).map((s: any) => [s.topic_id, s.prob_sim ?? 0.5]));

  // Agrupa apostas por tópico
  const betsByTopic = new Map<string, any[]>();
  for (const b of bets ?? []) {
    const arr = betsByTopic.get(b.topic_id) ?? [];
    arr.push(b);
    betsByTopic.set(b.topic_id, arr);
  }

  // Agrupa ordens por tópico
  const ordersByTopic = new Map<string, any[]>();
  for (const o of orders ?? []) {
    const arr = ordersByTopic.get(o.topic_id) ?? [];
    arr.push(o);
    ordersByTopic.set(o.topic_id, arr);
  }

  // Agrupa apostas resolvidas por tópico
  const resolvedByTopic = new Map<string, any[]>();
  for (const b of resolvedBets ?? []) {
    const arr = resolvedByTopic.get(b.topic_id) ?? [];
    arr.push(b);
    resolvedByTopic.set(b.topic_id, arr);
  }

  const totalTopics = activeTopicIds.length;
  const totalBets   = (bets ?? []).length;

  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Posições</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {totalBets} palpite{totalBets !== 1 ? "s" : ""} ativo{totalBets !== 1 ? "s" : ""} em {totalTopics} evento{totalTopics !== 1 ? "s" : ""}
        </p>
      </div>

      {activeTopicIds.length === 0 && resolvedTopicIds.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white font-medium mb-1">Nenhuma posição ativa</p>
          <p className="text-muted-foreground text-sm">Explore os eventos e faça seu primeiro palpite</p>
          <Link href="/liga" className="inline-block mt-4 px-4 py-2 bg-primary text-black font-semibold rounded-lg text-sm">
            Ver eventos
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
        {activeTopicIds.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Ativos</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{activeTopicIds.length}</span>
          </div>
          <div className="space-y-4">
          {activeTopicIds.map(topicId => {
            const topic     = topicMap.get(topicId);
            if (!topic) return null;
            const probSim   = probMap.get(topicId) ?? 0.5;
            const probNao   = 1 - probSim;
            const topicBets = betsByTopic.get(topicId) ?? [];
            const topicOrders = ordersByTopic.get(topicId) ?? [];

            // Calcula posição por lado
            const buildPos = (side: "sim" | "nao") => {
              const sideBets = topicBets.filter((b: any) => b.side === side);
              if (!sideBets.length) return null;
              const totalAmt = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
              const weightedEntry = sideBets.reduce((s: number, b: any) =>
                s + (1 / parseFloat(b.locked_odds)) * parseFloat(b.amount), 0) / totalAmt;
              const currentProb  = side === "sim" ? probSim : probNao;
              const currentValue = totalAmt * (currentProb / weightedEntry);
              const pnl          = currentValue - totalAmt;
              const pnlPct       = (pnl / totalAmt) * 100;
              return { totalAmt, weightedEntry, currentProb, currentValue, pnl, pnlPct };
            };

            const simPos = buildPos("sim");
            const naoPos = buildPos("nao");

            return (
              <div key={topicId} className="bg-card border border-border rounded-xl p-4 space-y-3">
                {/* Cabeçalho do tópico */}
                <div className="flex items-start gap-2">
                  <CategoryBadge category={topic.category} />
                  {topic.status !== "active" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {topic.status === "resolved" ? "Resolvido" : "Fechado"}
                    </span>
                  )}
                </div>
                <Link href={topic.category === "economia" ? `/economico/${topicId}` : `/liga/${topicId}`} className="block text-sm font-semibold text-white hover:text-primary transition-colors line-clamp-2">
                  {topic.title}
                </Link>

                {/* Posições */}
                {[simPos && { pos: simPos, side: "sim" as const }, naoPos && { pos: naoPos, side: "nao" as const }]
                  .filter(Boolean)
                  .map(({ pos, side }: any) => {
                    const positive = pos.pnl >= 0;
                    const color    = side === "sim" ? "text-sim" : "text-nao";
                    const bg       = side === "sim" ? "bg-sim/5 border-sim/20" : "bg-nao/5 border-nao/20";
                    return (
                      <div key={side} className={`rounded-lg border p-2.5 ${bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${color}`}>{side.toUpperCase()}</span>
                          <span className={`text-xs font-semibold flex items-center gap-1 ${positive ? "text-sim" : "text-nao"}`}>
                            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {positive ? "+" : ""}{pos.pnlPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                          <span className="text-muted-foreground">Palpitado</span>
                          <span className="text-right text-white">{fmt(pos.totalAmt)}</span>
                          <span className="text-muted-foreground">Entrada</span>
                          <span className="text-right text-white">{fmtPct(pos.weightedEntry)}</span>
                          <span className="text-muted-foreground">Atual</span>
                          <span className="text-right text-white">{fmtPct(pos.currentProb)}</span>
                          <span className="text-muted-foreground">Valor atual</span>
                          <span className={`text-right font-semibold ${positive ? "text-sim" : "text-nao"}`}>
                            {fmt(pos.currentValue)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Ordens abertas */}
                {topicOrders.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <p className="text-[10px] text-muted-foreground font-medium">Ordens abertas</p>
                    {topicOrders.map((o: any) => {
                      const unfilled = parseFloat(o.quantity) - parseFloat(o.filled_qty);
                      const sideColor = o.side === "sim" ? "text-sim" : "text-nao";
                      return (
                        <div key={o.id} className="flex items-center justify-between text-[11px]">
                          <span className={`font-semibold ${sideColor}`}>
                            {o.side.toUpperCase()} {o.order_type === "buy" ? "COMPRA" : "VENDA"}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock size={10} />
                            {fmtPct(o.price)} · {fmt(unfilled)} restante
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </section>
        )}

        {resolvedTopicIds.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Resolvidos</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{resolvedTopicIds.length}</span>
          </div>
          <div className="space-y-4">
          {resolvedTopicIds.map(topicId => {
            const topic = topicMap.get(topicId);
            if (!topic) return null;
            const tBets = resolvedByTopic.get(topicId) ?? [];

            // Resultado do evento: SIM, NÃO ou anulado (reembolso)
            const anulado = tBets.every((b: any) => b.status === "refunded");
            const resultado = topic.resolution === "sim" ? "SIM" : topic.resolution === "nao" ? "NÃO" : null;

            // Agrupa as apostas resolvidas por lado
            const buildResolved = (side: "sim" | "nao") => {
              const sideBets = tBets.filter((b: any) => b.side === side);
              if (!sideBets.length) return null;
              const totalAmt = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
              const payout = sideBets.reduce((s: number, b: any) => s + (parseFloat(b.potential_payout) || 0), 0);
              const status = sideBets[0].status as "won" | "lost" | "refunded";
              return { totalAmt, payout, status };
            };
            const simRes = buildResolved("sim");
            const naoRes = buildResolved("nao");

            return (
              <div key={topicId} className="bg-card border border-border rounded-xl p-4 space-y-3">
                {/* Cabeçalho do tópico */}
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={topic.category} />
                  {anulado ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">ANULADO</span>
                  ) : resultado ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${resultado === "SIM" ? "bg-sim/15 text-sim" : "bg-nao/15 text-nao"}`}>
                      RESULTADO: {resultado}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Resolvido</span>
                  )}
                </div>
                <Link href={topic.category === "economia" ? `/economico/${topicId}` : `/liga/${topicId}`} className="block text-sm font-semibold text-white hover:text-primary transition-colors line-clamp-2">
                  {topic.title}
                </Link>

                {/* Resultado por lado */}
                {[simRes && { res: simRes, side: "sim" as const }, naoRes && { res: naoRes, side: "nao" as const }]
                  .filter(Boolean)
                  .map(({ res, side }: any) => {
                    const sideColor = side === "sim" ? "text-sim" : "text-nao";
                    const won = res.status === "won";
                    const refunded = res.status === "refunded";
                    const bg = refunded ? "bg-muted/30 border-border" : won ? "bg-sim/5 border-sim/20" : "bg-nao/5 border-nao/20";
                    return (
                      <div key={side} className={`rounded-lg border p-2.5 ${bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold ${sideColor}`}>{side.toUpperCase()}</span>
                          <span className={`text-xs font-bold flex items-center gap-1 ${refunded ? "text-muted-foreground" : won ? "text-sim" : "text-nao"}`}>
                            {refunded ? "Reembolsado" : won ? <><TrendingUp size={11} /> Você acertou</> : <><TrendingDown size={11} /> Você errou</>}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                          <span className="text-muted-foreground">Palpitado</span>
                          <span className="text-right text-white">{fmt(res.totalAmt)}</span>
                          <span className="text-muted-foreground">{refunded ? "Devolvido" : won ? "Recebido" : "Resultado"}</span>
                          <span className={`text-right font-semibold ${refunded ? "text-white" : won ? "text-sim" : "text-nao"}`}>
                            {refunded ? fmt(res.totalAmt) : won ? `+${fmt(res.payout)}` : `-${fmt(res.totalAmt)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
          </div>
        </section>
        )}
        </div>
      )}
    </div>
  );
}
