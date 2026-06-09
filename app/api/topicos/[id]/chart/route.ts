import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("market_type, created_at")
    .eq("id", id)
    .single();

  // ── Mercados multi-resultado: 1 linha por resultado ──────────────────────────
  // Reconstrói a série histórica de probabilidades a partir das apostas:
  // pool_i(t) = pool_semente_i + Σ(apostas em i até t). prob_i = pool_i / Σpool.
  if (topic?.market_type === "multi") {
    const [{ data: outcomes }, { data: bets }] = await Promise.all([
      supabase
        .from("topic_outcomes")
        .select("id, label, pool, position")
        .eq("topic_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("bets")
        .select("outcome_id, amount, created_at")
        .eq("topic_id", id)
        .not("outcome_id", "is", null)
        .order("created_at", { ascending: true }),
    ]);

    const outs = outcomes ?? [];
    const allBets = bets ?? [];

    // Semente = pool atual − soma das apostas reais naquele resultado.
    const betSum = new Map<string, number>();
    for (const b of allBets) {
      betSum.set(b.outcome_id, (betSum.get(b.outcome_id) ?? 0) + Number(b.amount));
    }
    const running = new Map<string, number>(
      outs.map((o: any) => [o.id, Math.max(0, Number(o.pool) - (betSum.get(o.id) ?? 0))])
    );

    function snapshot(time: string) {
      const total = [...running.values()].reduce((s, v) => s + v, 0) || 1;
      const probs: Record<string, number> = {};
      for (const o of outs) {
        probs[o.id] = parseFloat(((running.get(o.id)! / total) * 100).toFixed(2));
      }
      return { time, ...probs };
    }

    const points = [snapshot(topic.created_at)];
    for (const b of allBets) {
      running.set(b.outcome_id, (running.get(b.outcome_id) ?? 0) + Number(b.amount));
      points.push(snapshot(b.created_at));
    }
    // Ponto ao vivo refletindo os pools atuais.
    points.push(snapshot(new Date().toISOString()));

    return NextResponse.json({
      marketType: "multi",
      outcomes: outs.map((o: any) => ({ id: o.id, label: o.label })),
      points,
    });
  }

  // ── Mercados binários: snapshots SIM/NÃO existentes ──────────────────────────
  const [{ data: snapshots }, { data: stats }] = await Promise.all([
    supabase
      .from("topic_snapshots")
      .select("prob_sim, volume_sim, volume_nao, recorded_at")
      .eq("topic_id", id)
      .order("recorded_at", { ascending: true })
      .limit(500),
    supabase.from("v_topic_stats").select("*").eq("topic_id", id).single(),
  ]);

  return NextResponse.json({ marketType: "binary", snapshots: snapshots ?? [], stats });
}
