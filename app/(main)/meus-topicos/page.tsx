export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

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

  // Buscar tópicos únicos (ativos + resolvidos)
  const activeTopicIds = [...new Set((bets ?? []).map((b: any) => b.topic_id))];
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

  // Agrupa apostas resolvidas por tópico
  const resolvedByTopic = new Map<string, any[]>();
  for (const b of resolvedBets ?? []) {
    const arr = resolvedByTopic.get(b.topic_id) ?? [];
    arr.push(b);
    resolvedByTopic.set(b.topic_id, arr);
  }

  // ── Monta as linhas das tabelas (uma linha por lado palpitado) ──
  type ActiveRow = { topicId: string; topic: any; side: "sim" | "nao"; totalAmt: number; currentProb: number; currentValue: number; pnl: number; pnlPct: number };
  const activeRows: ActiveRow[] = [];
  for (const topicId of activeTopicIds) {
    const topic = topicMap.get(topicId);
    if (!topic) continue;
    const probSim = probMap.get(topicId) ?? 0.5;
    const topicBets = betsByTopic.get(topicId) ?? [];
    for (const side of ["sim", "nao"] as const) {
      const sideBets = topicBets.filter((b: any) => b.side === side);
      if (!sideBets.length) continue;
      const totalAmt = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
      const weightedEntry = sideBets.reduce((s: number, b: any) => s + (1 / parseFloat(b.locked_odds)) * parseFloat(b.amount), 0) / totalAmt;
      const currentProb = side === "sim" ? probSim : 1 - probSim;
      const currentValue = totalAmt * (currentProb / weightedEntry);
      const pnl = currentValue - totalAmt;
      const pnlPct = (pnl / totalAmt) * 100;
      activeRows.push({ topicId, topic, side, totalAmt, currentProb, currentValue, pnl, pnlPct });
    }
  }

  type ResolvedRow = { topicId: string; topic: any; side: "sim" | "nao"; totalAmt: number; payout: number; status: "won" | "lost" | "refunded"; resultado: "SIM" | "NÃO" | null };
  const resolvedRows: ResolvedRow[] = [];
  for (const topicId of resolvedTopicIds) {
    const topic = topicMap.get(topicId);
    if (!topic) continue;
    const tBets = resolvedByTopic.get(topicId) ?? [];
    const resultado = topic.resolution === "sim" ? "SIM" : topic.resolution === "nao" ? "NÃO" : null;
    for (const side of ["sim", "nao"] as const) {
      const sideBets = tBets.filter((b: any) => b.side === side);
      if (!sideBets.length) continue;
      const totalAmt = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
      const payout = sideBets.reduce((s: number, b: any) => s + (parseFloat(b.potential_payout) || 0), 0);
      const status = sideBets[0].status as "won" | "lost" | "refunded";
      resolvedRows.push({ topicId, topic, side, totalAmt, payout, status, resultado });
    }
  }

  const wins = resolvedRows.filter((r) => r.status === "won").length;
  const losses = resolvedRows.filter((r) => r.status === "lost").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  const href = (t: any) => (t.category === "economia" ? `/economico/${t.id}` : `/liga/${t.id}`);
  const SideTag = ({ side }: { side: "sim" | "nao" }) => (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${side === "sim" ? "bg-sim/15 text-sim" : "bg-nao/15 text-nao"}`}>
      {side.toUpperCase()}
    </span>
  );

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Posições</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {activeRows.length} posiç{activeRows.length !== 1 ? "ões" : "ão"} ativa{activeRows.length !== 1 ? "s" : ""}
          {decided > 0 && <> · {wins}V / {losses}D · {winRate.toFixed(0)}% de acerto</>}
        </p>
      </div>

      {activeRows.length === 0 && resolvedRows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white font-medium mb-1">Nenhuma posição ainda</p>
          <p className="text-muted-foreground text-sm">Explore os eventos e faça seu primeiro palpite</p>
          <Link href="/liga" className="inline-block mt-4 px-4 py-2 bg-primary text-black font-semibold rounded-lg text-sm">
            Ver eventos
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── ATIVOS ── */}
          {activeRows.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Ativos</h2>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{activeRows.length}</span>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium">Evento</th>
                      <th className="py-2 px-3 font-medium">Palpite</th>
                      <th className="py-2 px-3 font-medium text-right">Palpitado</th>
                      <th className="py-2 px-3 font-medium text-right">Prob. atual</th>
                      <th className="py-2 px-3 font-medium text-right">Valor atual</th>
                      <th className="py-2 pl-3 font-medium text-right">Lucro/Prej.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((r) => {
                      const positive = r.pnl >= 0;
                      return (
                        <tr key={`${r.topicId}-${r.side}`} className="border-b border-border/50 hover:bg-card/60 transition-colors">
                          <td className="py-3 pr-3 max-w-[260px]">
                            <Link href={href(r.topic)} className="block text-white hover:text-primary transition-colors font-medium line-clamp-2">
                              {r.topic.title}
                            </Link>
                            <div className="mt-1"><CategoryBadge category={r.topic.category} /></div>
                          </td>
                          <td className="py-3 px-3"><SideTag side={r.side} /></td>
                          <td className="py-3 px-3 text-right text-white">{fmt(r.totalAmt)}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{fmtPct(r.currentProb)}</td>
                          <td className="py-3 px-3 text-right text-white font-medium">{fmt(r.currentValue)}</td>
                          <td className={`py-3 pl-3 text-right font-bold ${positive ? "text-sim" : "text-nao"}`}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              {positive ? "+" : ""}{r.pnlPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── RESOLVIDOS ── */}
          {resolvedRows.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Resolvidos</h2>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{resolvedRows.length}</span>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium">Resultado</th>
                      <th className="py-2 px-3 font-medium">Evento</th>
                      <th className="py-2 px-3 font-medium">Palpite</th>
                      <th className="py-2 px-3 font-medium">Deu</th>
                      <th className="py-2 px-3 font-medium text-right">Palpitado</th>
                      <th className="py-2 pl-3 font-medium text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedRows.map((r) => {
                      const won = r.status === "won";
                      const refunded = r.status === "refunded";
                      return (
                        <tr key={`${r.topicId}-${r.side}`} className="border-b border-border/50 hover:bg-card/60 transition-colors">
                          <td className="py-3 pr-3">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-extrabold ${
                              refunded ? "bg-muted text-muted-foreground" : won ? "bg-sim/20 text-sim" : "bg-nao/20 text-nao"
                            }`}>
                              {refunded ? "ANULADO" : won ? "ACERTOU" : "ERROU"}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[240px]">
                            <Link href={href(r.topic)} className="block text-white hover:text-primary transition-colors font-medium line-clamp-2">
                              {r.topic.title}
                            </Link>
                            <div className="mt-1"><CategoryBadge category={r.topic.category} /></div>
                          </td>
                          <td className="py-3 px-3"><SideTag side={r.side} /></td>
                          <td className="py-3 px-3">
                            {r.resultado ? <SideTag side={r.resultado === "SIM" ? "sim" : "nao"} /> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-3 text-right text-white">{fmt(r.totalAmt)}</td>
                          <td className={`py-3 pl-3 text-right font-bold ${refunded ? "text-muted-foreground" : won ? "text-sim" : "text-nao"}`}>
                            {refunded ? fmt(r.totalAmt) : won ? `+${fmt(r.payout - r.totalAmt)}` : `-${fmt(r.totalAmt)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
