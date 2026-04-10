"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, AlertTriangle, X, Loader2,
  ChevronDown, Info, RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderLevel {
  price: number;
  quantity: number;
  count: number;
  username: string | null;
}

interface TradePoint { price: number; time: string }

interface SideBook {
  bids: OrderLevel[];
  asks: OrderLevel[];
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  last_price: number | null;
  last_trade_at: string | null;
  volume_24h: number;
  liquidity: "alta" | "media" | "baixa";
  trade_history: TradePoint[];
}

interface BetRef { id: string; amount: number }

interface UserPosition {
  total_amount: number;
  avg_entry_price: number;
  current_price: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  sell_now_estimate: number | null;
  bet_ids: BetRef[];
}

interface OpenOrder {
  id: string;
  user_id: string;
  side: "sim" | "nao";
  order_type: "buy" | "sell";
  price: number;
  quantity: number;
  filled_qty: number;
  status: string;
  created_at: string;
  is_mine: boolean;
  username: string | null;
}

interface OrderBookData {
  topic_id: string;
  sim: SideBook;
  nao: SideBook;
  user_position: { sim: UserPosition | null; nao: UserPosition | null } | null;
  user_orders: OpenOrder[];
}

interface Props {
  topicId: string;
  isActive: boolean;
  userBets?: { id: string; side: "sim" | "nao"; amount: number; status: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LIQUIDITY_LABEL = {
  alta:  { text: "Alta",   cls: "text-sim",            dot: "bg-sim" },
  media: { text: "Média",  cls: "text-yellow-400",      dot: "bg-yellow-400" },
  baixa: { text: "Baixa",  cls: "text-muted-foreground", dot: "bg-muted-foreground" },
};

function pct(p: number)  { return `${(p * 100).toFixed(1)}%`; }
function qty(q: number)  { return `Z$ ${q.toFixed(2)}`; }
function odds(p: number) { return p > 0 ? `${(1 / p).toFixed(2)}x` : "—"; }

function Sparkline({ data, color }: { data: TradePoint[]; color: string }) {
  if (data.length < 2) return null;
  const W = 200, H = 40, PAD = 2;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 0.01;
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + ((1 - (d.price - min) / range)) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DepthRow({
  level, type, maxQty,
}: { level: OrderLevel; type: "bid" | "ask"; maxQty: number }) {
  const fillPct = maxQty > 0 ? (level.quantity / maxQty) * 100 : 0;
  const isBid   = type === "bid";
  const userLabel = level.count > 1
    ? `${level.count} usuários`
    : level.username ? `@${level.username}` : null;
  return (
    <div className="relative text-[11px] py-[3px] px-1.5 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 ${isBid ? "right-0" : "left-0"} ${isBid ? "bg-sim/10" : "bg-nao/10"}`}
        style={{ width: `${fillPct}%` }}
      />
      <div className="relative flex items-center justify-between">
        <span className={`font-mono ${isBid ? "text-sim" : "text-nao"}`}>{pct(level.price)}</span>
        <span className="text-muted-foreground font-mono">{level.quantity.toFixed(0)}</span>
      </div>
      {userLabel && (
        <div className="relative text-[9px] text-muted-foreground/70 mt-0.5">
          {isBid ? "oferta de" : "venda de"} {userLabel}
        </div>
      )}
    </div>
  );
}

function LiquidityBadge({ liquidity, spread }: { liquidity: SideBook["liquidity"]; spread: number | null }) {
  const { text, cls, dot } = LIQUIDITY_LABEL[liquidity];
  return (
    <span className={`flex items-center gap-1 text-[10px] ${cls}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      Liquidez {text}
      {spread !== null && <span className="text-muted-foreground">· spread {(spread * 100).toFixed(1)}¢</span>}
    </span>
  );
}

function PositionCard({
  pos, side,
}: { pos: UserPosition; side: "sim" | "nao" }) {
  const positive  = pos.pnl >= 0;
  const sideColor = side === "sim" ? "text-sim" : "text-nao";
  const sideBg    = side === "sim" ? "bg-sim/10 border-sim/20" : "bg-nao/10 border-nao/20";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${sideBg}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${sideColor}`}>{side.toUpperCase()}</span>
        <span className={`text-xs font-semibold ${positive ? "text-sim" : "text-nao"}`}>
          {positive ? "+" : ""}{pos.pnl_pct.toFixed(1)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="text-muted-foreground">Investido</div>
        <div className="text-right text-white">{qty(pos.total_amount)}</div>
        <div className="text-muted-foreground">Entrada</div>
        <div className="text-right text-white">
          {pct(pos.avg_entry_price)}
          <span className="text-muted-foreground ml-1">({odds(pos.avg_entry_price)})</span>
        </div>
        <div className="text-muted-foreground">Atual</div>
        <div className="text-right text-white">
          {pct(pos.current_price)}
          <span className="text-muted-foreground ml-1">({odds(pos.current_price)})</span>
        </div>
        <div className="text-muted-foreground">Valor atual</div>
        <div className={`text-right font-semibold ${positive ? "text-sim" : "text-nao"}`}>{qty(pos.current_value)}</div>
      </div>
      {pos.sell_now_estimate !== null && (
        <div className="pt-1.5 border-t border-border/40 text-[11px]">
          <span className="text-muted-foreground">Se vender agora (est.): </span>
          <span className={`font-semibold ${pos.sell_now_estimate >= pos.total_amount ? "text-sim" : "text-nao"}`}>
            ~{qty(pos.sell_now_estimate)}
          </span>
          <span className="text-muted-foreground text-[10px] ml-1">(após 2% taxa)</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MercadoSecundario({ topicId, isActive, userBets = [] }: Props) {
  const router = useRouter();

  const [data, setData]       = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Form state
  const [side, setSide]             = useState<"sim" | "nao">("sim");
  const [orderType, setOrderType]   = useState<"buy" | "sell">("buy");
  const [isMarket, setIsMarket]     = useState(false);
  const [price, setPrice]           = useState("");
  const [quantity, setQuantity]     = useState("");
  const [sourceBetId, setSourceBetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Cancel order
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchBook = useCallback(async () => {
    const res = await fetch(`/api/topicos/${topicId}/orderbook`, { cache: "no-store" });
    if (!res.ok) { setError("Erro ao carregar livro de ordens"); setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
    setError(null);
  }, [topicId]);

  useEffect(() => { fetchBook(); }, [fetchBook]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const book          = data ? (side === "sim" ? data.sim : data.nao) : null;
  const userPos       = data?.user_position?.[side] ?? null;

  // Bets available to sell on selected side
  const sellableBets  = userBets.filter(b =>
    b.side === side && ["pending", "matched", "partial"].includes(b.status)
  );

  const escrowNeeded  = orderType === "buy" && !isMarket && price && quantity
    ? parseFloat((parseFloat(price) / 100 * parseFloat(quantity)).toFixed(2))
    : null;

  const effectivePrice = isMarket
    ? (orderType === "buy" ? 0.99 : 0.01)
    : (price ? parseFloat(price) / 100 : null);

  // Warnings
  const noSellers      = book && book.asks.length === 0 && orderType === "buy";
  const noBuyers       = book && book.bids.length === 0 && orderType === "sell";
  const lowLiquidity   = book?.liquidity === "baixa";
  const sellAtLoss     = orderType === "sell" && userPos && effectivePrice !== null
    && effectivePrice < userPos.avg_entry_price;

  // ── Submit order ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);

    if (!quantity || parseFloat(quantity) < 1) {
      setFormMsg({ type: "err", text: "Quantidade mínima: Z$ 1,00" });
      return;
    }
    if (!isMarket && (!price || parseFloat(price) <= 0 || parseFloat(price) >= 100)) {
      setFormMsg({ type: "err", text: "Preço deve estar entre 1¢ e 99¢" });
      return;
    }
    if (orderType === "sell" && !sourceBetId) {
      setFormMsg({ type: "err", text: "Selecione a aposta a vender" });
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      side,
      order_type: orderType,
      quantity: parseFloat(quantity),
      is_market: isMarket,
    };
    if (!isMarket) body.price = parseFloat(price) / 100;
    if (orderType === "sell") body.source_bet_id = sourceBetId;

    const res = await fetch(`/api/topicos/${topicId}/ordem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setFormMsg({ type: "err", text: json.error ?? "Erro ao criar ordem" });
      return;
    }

    const filled = json.total_filled ?? 0;
    const orderStatus = json.order?.status;

    if (orderStatus === "cancelled" || orderStatus === "expired") {
      setFormMsg({
        type: "err",
        text: isMarket
          ? "Nenhuma contraparte disponível agora. Tente uma ordem limitada para ficar no livro aguardando."
          : "Ordem cancelada inesperadamente. Tente novamente.",
      });
      fetchBook();
      return;
    }

    const msg = filled > 0 && orderStatus === "filled"
      ? `Executada por completo: ${qty(filled)}`
      : filled > 0
        ? `Parcialmente executada: ${qty(filled)} — restante no livro`
        : "Ordem registrada no livro de ofertas";
    setFormMsg({ type: "ok", text: msg });
    setQuantity("");
    setPrice("");
    setSourceBetId("");
    fetchBook();
    router.refresh();
  }

  // ── Cancel order ───────────────────────────────────────────────────────────
  async function handleCancel(orderId: string) {
    setCancelling(orderId);
    const res = await fetch(`/api/topicos/${topicId}/ordem/${orderId}`, { method: "DELETE" });
    setCancelling(null);
    if (res.ok) { fetchBook(); router.refresh(); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center h-32">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground text-center">
        {error ?? "Sem dados"}
      </div>
    );
  }

  const maxBid = book ? Math.max(...book.bids.map(b => b.quantity), 1) : 1;
  const maxAsk = book ? Math.max(...book.asks.map(a => a.quantity), 1) : 1;

  // Total investido: soma direta das apostas passadas pelo servidor (mais confiável)
  const totalInvested = (userBets ?? []).reduce((s, b) => s + parseFloat(b.amount as any), 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Mercado Secundário</h3>
        <button
          onClick={fetchBook}
          className="text-muted-foreground hover:text-white transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Posição total no evento */}
      {totalInvested > 0 && (
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
          <span className="text-muted-foreground">Você tem aqui</span>
          <span className="font-bold text-white">{formatCurrency(totalInvested)}</span>
        </div>
      )}

      {/* Side tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border text-xs font-semibold">
        {(["sim", "nao"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`flex-1 py-1.5 transition-colors ${
              side === s
                ? s === "sim" ? "bg-sim text-black" : "bg-nao text-white"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Liquidity + last price */}
      <div className="flex items-center justify-between">
        <LiquidityBadge liquidity={book!.liquidity} spread={book!.spread} />
        {book!.last_price !== null && (
          <span className="text-[10px] text-muted-foreground">
            Último: <span className="text-white font-mono">{pct(book!.last_price)}</span>
          </span>
        )}
      </div>

      {/* Volume 24h */}
      {book!.volume_24h > 0 && (
        <p className="text-[10px] text-muted-foreground -mt-2">
          Vol 24h: {qty(book!.volume_24h)}
        </p>
      )}

      {/* Sparkline histórico de trades */}
      {book!.trade_history.length >= 2 && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground">Histórico de preços</p>
          <Sparkline
            data={book!.trade_history}
            color={side === "sim" ? "#4ade80" : "#f87171"}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
            <span>{pct(Math.min(...book!.trade_history.map(d => d.price)))}</span>
            <span>{pct(Math.max(...book!.trade_history.map(d => d.price)))}</span>
          </div>
        </div>
      )}

      {/* Order depth */}
      <div className="space-y-1">
        {/* Asks (sell side — lowest price first) */}
        <div className="grid grid-cols-2 text-[10px] text-muted-foreground px-1.5 mb-0.5">
          <span>Preço (asks)</span><span className="text-right">Qtd</span>
        </div>
        {book!.asks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-1">Sem vendedores</p>
        ) : (
          [...book!.asks].reverse().map((lvl, i) => (
            <DepthRow key={i} level={lvl} type="ask" maxQty={maxAsk} />
          ))
        )}

        {/* Spread indicator */}
        <div className="h-px bg-border/60 my-1" />

        {/* Bids (buy side — highest price first) */}
        {book!.bids.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-1">Sem compradores</p>
        ) : (
          book!.bids.map((lvl, i) => (
            <DepthRow key={i} level={lvl} type="bid" maxQty={maxBid} />
          ))
        )}
        <div className="grid grid-cols-2 text-[10px] text-muted-foreground px-1.5 mt-0.5">
          <span>Preço (bids)</span><span className="text-right">Qtd</span>
        </div>
      </div>

      {/* User position */}
      {userPos && <PositionCard pos={userPos} side={side} />}

      {/* Order form */}
      {isActive && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1 border-t border-border/40">
          <p className="text-xs font-semibold text-white">Nova ordem</p>

          {/* Buy / Sell tabs */}
          <div className="flex rounded-lg overflow-hidden border border-border text-[11px] font-semibold">
            {(["buy", "sell"] as const).map(t => {
              const canSell = t === "sell" && sellableBets.length === 0;
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => { if (!canSell) { setOrderType(t); setFormMsg(null); } }}
                  disabled={canSell}
                  title={canSell ? `Sem apostas ${side.toUpperCase()} para vender` : undefined}
                  className={`flex-1 py-1.5 transition-colors ${
                    orderType === t
                      ? t === "buy" ? "bg-sim text-black" : "bg-nao text-white"
                      : canSell
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {t === "buy" ? "Comprar" : "Vender"}
                </button>
              );
            })}
          </div>

          {/* Market / Limit toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setIsMarket(v => !v)}
              className={`relative w-8 h-4 rounded-full transition-colors ${isMarket ? "bg-sim" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isMarket ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isMarket ? "Mercado (executa agora)" : "Limite"}
            </span>
          </label>

          {/* Quantity */}
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Quantidade (Z$)</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Ex: 10"
              min={1}
              step={1}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Price (limit only) */}
          {!isMarket && (
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Preço (¢ por Z$1)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Ex: 65"
                min={1}
                max={99}
                step={1}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-white/30"
              />
            </div>
          )}

          {/* Source bet (sell only) */}
          {orderType === "sell" && (
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Aposta a vender</label>
              {sellableBets.length === 0 ? (
                <p className="text-[11px] text-nao">Sem apostas {side.toUpperCase()} para vender.</p>
              ) : (
                <select
                  value={sourceBetId}
                  onChange={e => setSourceBetId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
                >
                  <option value="">Selecionar aposta...</option>
                  {sellableBets.map(b => (
                    <option key={b.id} value={b.id}>
                      Z$ {b.amount.toFixed(2)} · {b.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Escrow info */}
          {escrowNeeded !== null && escrowNeeded > 0 && (
            <div className="flex items-start gap-1.5 bg-muted/30 rounded-lg p-2 text-[11px] text-muted-foreground">
              <Info size={11} className="mt-0.5 shrink-0" />
              <span>Reserva de saldo (escrow): <span className="text-white">{qty(escrowNeeded)}</span> — devolvido se cancelar</span>
            </div>
          )}

          {/* Warnings */}
          {noSellers && (
            <div className="flex items-start gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-[11px] text-yellow-400">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              Sem vendedores agora. Sua ordem ficará no livro aguardando.
            </div>
          )}
          {noBuyers && (
            <div className="flex items-start gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-[11px] text-yellow-400">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              Sem compradores agora. Sua ordem ficará no livro aguardando.
            </div>
          )}
          {lowLiquidity && (
            <div className="flex items-start gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-[11px] text-yellow-400">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              Liquidez baixa — pode ser difícil executar ao preço desejado.
            </div>
          )}
          {sellAtLoss && (
            <div className="flex items-start gap-1.5 bg-nao/10 border border-nao/20 rounded-lg p-2 text-[11px] text-nao">
              <TrendingDown size={11} className="mt-0.5 shrink-0" />
              Você está vendendo abaixo do seu preço médio de entrada ({pct(userPos!.avg_entry_price)}). Isso resultará em prejuízo.
            </div>
          )}

          {/* Feedback */}
          {formMsg && (
            <div className={`text-[11px] rounded-lg p-2 ${
              formMsg.type === "ok"
                ? "bg-sim/10 text-sim"
                : "bg-nao/10 text-nao"
            }`}>
              {formMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (orderType === "sell" && sellableBets.length === 0)}
            className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              orderType === "buy"
                ? "bg-sim text-black hover:bg-sim/90"
                : "bg-nao text-white hover:bg-nao/90"
            }`}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin mx-auto" />
            ) : (
              `${orderType === "buy" ? "Comprar" : "Vender"} ${side.toUpperCase()}${isMarket ? " (mercado)" : ""}`
            )}
          </button>
        </form>
      )}

      {/* Open orders */}
      {data.user_orders.length > 0 && (
        <div className="pt-1 border-t border-border/40 space-y-2">
          <p className="text-xs font-semibold text-white">Ordens abertas</p>
          {data.user_orders.map(o => {
            const unfilled = o.quantity - o.filled_qty;
            return (
              <div
                key={o.id}
                className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded-lg border border-border/60 bg-muted/20"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold ${o.side === "sim" ? "text-sim" : "text-nao"}`}>
                      {o.side.toUpperCase()} {o.order_type === "buy" ? "COMPRA" : "VENDA"}
                    </span>
                    {o.is_mine && (
                      <span className="text-[9px] text-muted-foreground/50 border border-border/40 rounded px-1">você</span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {pct(o.price)} · {qty(unfilled)} restante
                    {o.filled_qty > 0 && <span className="text-sim"> · {qty(o.filled_qty)} exec.</span>}
                  </div>
                  {o.username && (
                    <div className="text-[10px] text-muted-foreground/60">@{o.username}</div>
                  )}
                </div>
                {o.is_mine && (
                  <button
                    onClick={() => handleCancel(o.id)}
                    disabled={cancelling === o.id}
                    className="ml-2 text-muted-foreground hover:text-nao transition-colors disabled:opacity-40"
                    title="Cancelar ordem"
                  >
                    {cancelling === o.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <X size={13} />
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2">
        Mercado secundário. Taxa de 2% sobre vendedor. Ordens limitadas ficam no livro até execução ou cancelamento.
      </p>
    </div>
  );
}
