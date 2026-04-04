/**
 * GET /api/topicos/[id]/orderbook
 *
 * Retorna o estado atual do order book para um tópico:
 * - Top bids e asks por lado (SIM / NÃO)
 * - Último trade, volume 24h, spread, liquidez
 * - Posição e ordens abertas do usuário (se autenticado)
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getLiquidity(spread: number | null, vol24h: number): "alta" | "media" | "baixa" {
  if (spread === null || vol24h === 0) return "baixa";
  if (spread <= 0.03 && vol24h >= 50)  return "alta";
  if (spread <= 0.08)                  return "media";
  return "baixa";
}

async function buildSideBook(admin: any, topicId: string, side: "sim" | "nao") {
  const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: bids }, { data: asks }, { data: lastTrades }, { data: vol24h }] =
    await Promise.all([
      // Top 5 ordens de compra (melhores preços primeiro)
      admin.from("orders").select("price, quantity, filled_qty")
        .eq("topic_id", topicId).eq("side", side).eq("order_type", "buy")
        .in("status", ["open", "partial"])
        .order("price", { ascending: false })
        .limit(20),

      // Top 5 ordens de venda
      admin.from("orders").select("price, quantity, filled_qty")
        .eq("topic_id", topicId).eq("side", side).eq("order_type", "sell")
        .in("status", ["open", "partial"])
        .order("price", { ascending: true })
        .limit(20),

      // Histórico de trades (último + sparkline)
      admin.from("trades").select("price, quantity, created_at")
        .eq("topic_id", topicId).eq("side", side)
        .order("created_at", { ascending: false })
        .limit(50),

      // Volume 24h
      admin.from("trades").select("quantity")
        .eq("topic_id", topicId).eq("side", side)
        .gte("created_at", cutoff24h),
    ]);

  // Agrupa ordens pelo mesmo preço
  const aggregateLevels = (orders: any[] | null) => {
    const map: Record<number, { price: number; quantity: number; count: number }> = {};
    for (const o of orders ?? []) {
      const p = parseFloat(o.price);
      const avail = parseFloat(o.quantity) - parseFloat(o.filled_qty);
      if (avail < 0.01) continue;
      if (!map[p]) map[p] = { price: p, quantity: 0, count: 0 };
      map[p].quantity = parseFloat((map[p].quantity + avail).toFixed(2));
      map[p].count++;
    }
    return Object.values(map).slice(0, 5);
  };

  const bidLevels  = aggregateLevels(bids);
  const askLevels  = aggregateLevels(asks);
  const bestBid    = bidLevels[0]?.price ?? null;
  const bestAsk    = askLevels[0]?.price ?? null;
  const spread     = bestBid !== null && bestAsk !== null
    ? parseFloat((bestAsk - bestBid).toFixed(4))
    : null;
  const volume24h  = (vol24h ?? []).reduce((s: number, r: any) => s + parseFloat(r.quantity), 0);
  const lastTrade  = lastTrades?.[0] ?? null;
  const tradeHistory = (lastTrades ?? [])
    .slice()
    .reverse()
    .map((t: any) => ({ price: parseFloat(t.price), time: t.created_at }));

  return {
    bids:       bidLevels.sort((a, b) => b.price - a.price),
    asks:       askLevels.sort((a, b) => a.price - b.price),
    best_bid:   bestBid,
    best_ask:   bestAsk,
    spread,
    last_price:    lastTrade ? parseFloat(lastTrade.price) : null,
    last_trade_at: lastTrade?.created_at ?? null,
    volume_24h:    parseFloat(volume24h.toFixed(2)),
    liquidity:     getLiquidity(spread, volume24h),
    trade_history: tradeHistory,
  };
}

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [simBook, naoBook] = await Promise.all([
    buildSideBook(admin, topicId, "sim"),
    buildSideBook(admin, topicId, "nao"),
  ]);

  // Posição do usuário (apostas ativas)
  let userPosition: Record<string, any> | null = null;
  let userOrders: any[] = [];

  if (user) {
    const [{ data: bets }, { data: orders }, { data: stats }] = await Promise.all([
      admin.from("bets").select("id, side, amount, locked_odds, status")
        .eq("topic_id", topicId).eq("user_id", user.id)
        .in("status", ["pending", "matched", "partial"]),

      admin.from("orders").select("*")
        .eq("topic_id", topicId).eq("user_id", user.id)
        .in("status", ["open", "partial"])
        .order("created_at", { ascending: false }),

      admin.from("v_topic_stats").select("prob_sim, volume_sim, volume_nao")
        .eq("topic_id", topicId).single(),
    ]);

    userOrders = orders ?? [];

    const probSim = stats?.prob_sim ?? 0.5;
    const probNao = 1 - probSim;

    const buildPosition = (side: "sim" | "nao") => {
      const sideBets = (bets ?? []).filter((b: any) => b.side === side);
      if (!sideBets.length) return null;

      const totalAmount = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
      // Preço médio de entrada ponderado por amount
      const weightedEntry = sideBets.reduce((s: number, b: any) =>
        s + (1 / parseFloat(b.locked_odds)) * parseFloat(b.amount), 0) / totalAmount;

      const currentProb = side === "sim" ? probSim : probNao;
      const currentValue = parseFloat((totalAmount * (currentProb / weightedEntry)).toFixed(2));
      const pnl = parseFloat((currentValue - totalAmount).toFixed(2));
      const pnlPct = parseFloat(((pnl / totalAmount) * 100).toFixed(1));

      const bestBidForSide = side === "sim" ? simBook.best_bid : naoBook.best_bid;
      const sellNow = bestBidForSide !== null
        ? parseFloat((bestBidForSide * totalAmount * (1 - 0.02)).toFixed(2))
        : null;

      return {
        total_amount: parseFloat(totalAmount.toFixed(2)),
        avg_entry_price: parseFloat(weightedEntry.toFixed(4)),
        current_price: parseFloat(currentProb.toFixed(4)),
        current_value: currentValue,
        pnl,
        pnl_pct: pnlPct,
        sell_now_estimate: sellNow,
        bet_ids: sideBets.map((b: any) => ({ id: b.id, amount: parseFloat(b.amount) })),
      };
    };

    const simPos = buildPosition("sim");
    const naoPos = buildPosition("nao");

    if (simPos || naoPos) {
      userPosition = { sim: simPos, nao: naoPos };
    }
  }

  return NextResponse.json({
    topic_id: topicId,
    sim:      simBook,
    nao:      naoBook,
    user_position: userPosition,
    user_orders:   userOrders,
  });
}
