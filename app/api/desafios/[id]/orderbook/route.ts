/**
 * GET /api/desafios/[id]/orderbook
 *
 * Retorna o estado atual do order book para um desafio:
 * mesma estrutura que /api/topicos/[id]/orderbook, mas usa desafio_id e desafio_bets.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getLiquidity(spread: number | null, vol24h: number): "alta" | "media" | "baixa" {
  if (spread === null || vol24h === 0) return "baixa";
  if (spread <= 0.03 && vol24h >= 50)  return "alta";
  if (spread <= 0.08)                  return "media";
  return "baixa";
}

async function buildSideBook(admin: any, desafioId: string, side: "sim" | "nao") {
  const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: bids }, { data: asks }, { data: lastTrades }, { data: vol24h }] =
    await Promise.all([
      admin.from("orders").select("price, quantity, filled_qty, profiles!user_id(username, full_name)")
        .eq("desafio_id", desafioId).eq("side", side).eq("order_type", "buy")
        .in("status", ["open", "partial"])
        .order("price", { ascending: false })
        .limit(20),

      admin.from("orders").select("price, quantity, filled_qty, profiles!user_id(username, full_name)")
        .eq("desafio_id", desafioId).eq("side", side).eq("order_type", "sell")
        .in("status", ["open", "partial"])
        .order("price", { ascending: true })
        .limit(20),

      admin.from("trades").select("price, quantity, created_at")
        .eq("desafio_id", desafioId).eq("side", side)
        .order("created_at", { ascending: false })
        .limit(50),

      admin.from("trades").select("quantity")
        .eq("desafio_id", desafioId).eq("side", side)
        .gte("created_at", cutoff24h),
    ]);

  const extractUsername = (profiles: any): string | null => {
    const p = Array.isArray(profiles) ? profiles[0] : profiles;
    return p?.username ?? p?.full_name ?? null;
  };

  const aggregateLevels = (orders: any[] | null) => {
    const map: Record<number, { price: number; quantity: number; count: number; username: string | null }> = {};
    for (const o of orders ?? []) {
      const p = parseFloat(o.price);
      const avail = parseFloat(o.quantity) - parseFloat(o.filled_qty);
      if (avail < 0.01) continue;
      const username = extractUsername(o.profiles);
      if (!map[p]) map[p] = { price: p, quantity: 0, count: 0, username };
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
    bids:          bidLevels.sort((a, b) => b.price - a.price),
    asks:          askLevels.sort((a, b) => a.price - b.price),
    best_bid:      bestBid,
    best_ask:      bestAsk,
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
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [simBook, naoBook] = await Promise.all([
    buildSideBook(admin, desafioId, "sim"),
    buildSideBook(admin, desafioId, "nao"),
  ]);

  const { data: allOpenOrders } = await admin
    .from("orders")
    .select("id, user_id, side, order_type, price, quantity, filled_qty, status, created_at, profiles!user_id(username, full_name)")
    .eq("desafio_id", desafioId)
    .in("status", ["open", "partial"])
    .order("created_at", { ascending: false })
    .limit(100);

  let userPosition: Record<string, any> | null = null;

  if (user) {
    const [{ data: bets }, { data: stats }] = await Promise.all([
      admin.from("desafio_bets").select("id, side, amount, locked_odds, status")
        .eq("desafio_id", desafioId).eq("user_id", user.id)
        .in("status", ["matched"]),

      admin.from("v_desafio_stats").select("prob_sim, volume_sim, volume_nao")
        .eq("desafio_id", desafioId).single(),
    ]);

    const probSim = stats?.prob_sim ?? 0.5;
    const probNao = 1 - probSim;

    const buildPosition = (side: "sim" | "nao") => {
      const sideBets = (bets ?? []).filter((b: any) => b.side === side);
      if (!sideBets.length) return null;

      const totalAmount = sideBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
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
    if (simPos || naoPos) userPosition = { sim: simPos, nao: naoPos };
  }

  const enrichedOrders = (allOpenOrders ?? []).map((o: any) => {
    const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
    return {
      ...o,
      username: p?.username ?? p?.full_name ?? null,
      is_mine: user ? o.user_id === user.id : false,
    };
  });

  return NextResponse.json({
    desafio_id:    desafioId,
    sim:           simBook,
    nao:           naoBook,
    user_position: userPosition,
    user_orders:   enrichedOrders,
  });
}
