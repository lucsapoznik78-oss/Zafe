/**
 * Engine de matching do mercado secundário Zafe.
 *
 * Modelo: ordens limitadas com prioridade preço-tempo (FIFO).
 * Preço = probabilidade implícita [0.01, 0.99] — ex: 0.65 = 65¢ por Z$1 de face value.
 * Quantidade = Z$ de face value da posição negociada.
 *
 * Comissão: 2% sobre o vendedor, cobrada na execução.
 * O comprador paga exatamente o preço da ordem de venda (preço do maker).
 * Excesso de escrow do comprador é devolvido se executou abaixo do limite.
 */

export const COMMISSION_RATE = 0.06; // 6% ao vendedor

/** Calcula as odds parimutuel inline (sem import circular) */
function impliedOdds(volSim: number, volNao: number, side: "sim" | "nao") {
  const total = volSim + volNao;
  if (total === 0) return 2.0;
  const vol = side === "sim" ? volSim : volNao;
  return vol > 0 ? Math.min(total / vol, 999) : 999;
}

export interface MatchResult {
  tradesExecuted: number;
  totalFilled: number;
}

/**
 * Tenta casar a nova ordem com contra-ordens abertas.
 * Deve ser chamado logo após inserir a ordem.
 * Passe desafioId quando a ordem pertence a um desafio (usa desafio_bets em vez de bets).
 */
export async function tryMatchOrders(
  admin: any,
  newOrderId: string,
  desafioId?: string,
): Promise<MatchResult> {
  const { data: newOrder } = await admin
    .from("orders")
    .select("*")
    .eq("id", newOrderId)
    .single();

  if (!newOrder || !["open", "partial"].includes(newOrder.status)) {
    return { tradesExecuted: 0, totalFilled: 0 };
  }

  const isSell = newOrder.order_type === "sell";
  const idField = desafioId ? "desafio_id" : "topic_id";
  const idValue = desafioId ?? newOrder.topic_id;

  // Buscar contra-ordens compatíveis (preço-tempo priority)
  let q = admin
    .from("orders")
    .select("*")
    .eq(idField, idValue)
    .eq("side", newOrder.side)
    .eq("order_type", isSell ? "buy" : "sell")
    .in("status", ["open", "partial"])
    .neq("user_id", newOrder.user_id) // sem auto-trade
    .neq("id", newOrderId);

  if (isSell) {
    // Nova SELL: precisa de BUY com preço >= preço de venda
    q = q.gte("price", newOrder.price)
         .order("price", { ascending: false })
         .order("created_at", { ascending: true });
  } else {
    // Nova BUY: precisa de SELL com preço <= preço de compra
    q = q.lte("price", newOrder.price)
         .order("price", { ascending: true })
         .order("created_at", { ascending: true });
  }

  const { data: counterOrders } = await q.limit(20);
  if (!counterOrders?.length) return { tradesExecuted: 0, totalFilled: 0 };

  let tradesExecuted = 0;
  let totalFilled = 0;
  let remaining = parseFloat((newOrder.quantity - newOrder.filled_qty).toFixed(2));

  for (const counter of counterOrders) {
    if (remaining <= 0.01) break;

    const counterRemaining = parseFloat((counter.quantity - counter.filled_qty).toFixed(2));
    const matchQty = parseFloat(Math.min(remaining, counterRemaining).toFixed(2));

    // Executa ao preço do maker (counter order)
    const tradePrice = counter.price;

    const buyOrder  = isSell ? counter : newOrder;
    const sellOrder = isSell ? newOrder : counter;

    await executeTrade(admin, {
      topicId:          desafioId ? undefined : newOrder.topic_id,
      desafioId,
      side:             newOrder.side as "sim" | "nao",
      buyOrderId:       buyOrder.id,
      sellOrderId:      sellOrder.id,
      buyerId:          buyOrder.user_id,
      sellerId:         sellOrder.user_id,
      price:            tradePrice,
      quantity:         matchQty,
      buyLimitPrice:    buyOrder.price,
      sourceBetId:      sellOrder.source_bet_id ?? undefined,
    });

    // Atualiza counter order
    const counterFilled = parseFloat((counter.filled_qty + matchQty).toFixed(2));
    await admin.from("orders").update({
      filled_qty: counterFilled,
      status: counterFilled >= counter.quantity - 0.01 ? "filled" : "partial",
    }).eq("id", counter.id);

    remaining = parseFloat((remaining - matchQty).toFixed(2));
    totalFilled = parseFloat((totalFilled + matchQty).toFixed(2));
    tradesExecuted++;
  }

  // Atualiza nova ordem
  const newFilled = parseFloat((newOrder.filled_qty + totalFilled).toFixed(2));
  await admin.from("orders").update({
    filled_qty: newFilled,
    status:
      newFilled >= newOrder.quantity - 0.01
        ? "filled"
        : newFilled > 0
          ? "partial"
          : "open",
  }).eq("id", newOrderId);

  return { tradesExecuted, totalFilled };
}

/** Executa um trade individualmente (atômica o quanto possível) */
async function executeTrade(admin: any, p: {
  topicId?: string;
  desafioId?: string;
  side: "sim" | "nao";
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  quantity: number;
  buyLimitPrice: number;
  sourceBetId?: string;
}) {
  const isDesafio  = !!p.desafioId;
  const refId      = p.desafioId ?? p.topicId ?? "";
  const tradeValue  = parseFloat((p.price * p.quantity).toFixed(2));
  const commission  = parseFloat((tradeValue * COMMISSION_RATE).toFixed(2));
  const netSeller   = parseFloat((tradeValue - commission).toFixed(2));

  // ── 1. Gravar trade + notificar partes ───────────────────────────
  const notifData = isDesafio ? { desafio_id: p.desafioId } : { topic_id: p.topicId };
  await Promise.allSettled([
    admin.from("notifications").insert({
      user_id: p.buyerId,
      type:    "trade_executed",
      title:   "Ordem executada!",
      body:    `Sua compra ${p.side.toUpperCase()} foi executada: ${p.quantity.toFixed(0)} Z$ a ${(p.price * 100).toFixed(1)}¢`,
      data:    notifData,
    }),
    admin.from("notifications").insert({
      user_id: p.sellerId,
      type:    "trade_executed",
      title:   "Ordem executada!",
      body:    `Sua venda ${p.side.toUpperCase()} foi executada: ${p.quantity.toFixed(0)} Z$ a ${(p.price * 100).toFixed(1)}¢`,
      data:    notifData,
    }),
  ]);

  const tradeInsert: Record<string, unknown> = {
    buy_order_id:  p.buyOrderId,
    sell_order_id: p.sellOrderId,
    side:          p.side,
    price:         p.price,
    quantity:      p.quantity,
    buyer_id:      p.buyerId,
    seller_id:     p.sellerId,
  };
  if (isDesafio) {
    tradeInsert.desafio_id = p.desafioId;
  } else {
    tradeInsert.topic_id = p.topicId;
  }
  await admin.from("trades").insert(tradeInsert);

  // ── 2. Creditar vendedor ─────────────────────────────────────────
  const { data: sw } = await admin.from("wallets").select("balance").eq("user_id", p.sellerId).single();
  await admin.from("wallets").update({ balance: (sw?.balance ?? 0) + netSeller }).eq("user_id", p.sellerId);

  await admin.from("transactions").insert({
    user_id:      p.sellerId,
    type:         "bet_exited",
    amount:       tradeValue,
    net_amount:   netSeller,
    description:  `Venda mercado secundário ${p.side.toUpperCase()} · ${(p.price * 100).toFixed(1)}¢ · taxa 6%`,
    reference_id: refId,
  });

  // ── 3. Debitar comprador na execução ────────────────────────────
  const { data: bw } = await admin.from("wallets").select("balance").eq("user_id", p.buyerId).single();
  const buyerBalance = bw?.balance ?? 0;
  if (buyerBalance < tradeValue) {
    console.error(`[order-matching] Comprador sem saldo: tem ${buyerBalance}, precisa ${tradeValue}`);
    return;
  }
  const newBuyerBalance = parseFloat((buyerBalance - tradeValue).toFixed(2));
  await admin.from("wallets").update({ balance: newBuyerBalance }).eq("user_id", p.buyerId);

  await admin.from("transactions").insert({
    user_id:      p.buyerId,
    type:         "bet_placed",
    amount:       tradeValue,
    net_amount:   tradeValue,
    description:  `Compra mercado secundário ${p.side.toUpperCase()} · ${(p.price * 100).toFixed(1)}¢`,
    reference_id: refId,
  });

  // ── 4. Encerrar aposta do vendedor ───────────────────────────────
  const betTable = isDesafio ? "desafio_bets" : "bets";
  if (p.sourceBetId) {
    const { data: src } = await admin.from(betTable).select("amount").eq("id", p.sourceBetId).single();
    if (src) {
      const soldQty = p.quantity;
      if (src.amount - soldQty <= 0.01) {
        await admin.from(betTable).update({ status: "exited" }).eq("id", p.sourceBetId);
      } else {
        const newAmt = parseFloat((src.amount - soldQty).toFixed(2));
        if (isDesafio) {
          await admin.from(betTable).update({ amount: newAmt }).eq("id", p.sourceBetId);
        } else {
          await admin.from(betTable).update({ amount: newAmt, gross_amount: newAmt }).eq("id", p.sourceBetId);
        }
      }
    }
  }

  // ── 5. Criar aposta/posição para o comprador ────────────────────
  const entryOdds = parseFloat((1 / p.price).toFixed(4));

  if (isDesafio) {
    await admin.from("desafio_bets").insert({
      desafio_id:  p.desafioId,
      user_id:     p.buyerId,
      side:        p.side,
      amount:      p.quantity,
      locked_odds: entryOdds,
      status:      "matched",
    });
  } else {
    await admin.from("bets").insert({
      topic_id:         p.topicId,
      user_id:          p.buyerId,
      side:             p.side,
      amount:           p.quantity,
      gross_amount:     p.quantity,
      locked_odds:      entryOdds,
      status:           "matched",
      matched_amount:   p.quantity,
      unmatched_amount: 0,
      potential_payout: parseFloat((p.quantity * entryOdds).toFixed(2)),
      is_private:       false,
    });
  }
}

/**
 * Cancela todas as ordens abertas de um tópico (chamado na resolução/expiração).
 */
export async function cancelTopicOrders(admin: any, topicId: string) {
  const { data: openOrders } = await admin
    .from("orders")
    .select("*")
    .eq("topic_id", topicId)
    .in("status", ["open", "partial"]);

  for (const order of openOrders ?? []) {
    await admin.from("orders").update({ status: "expired" }).eq("id", order.id);
  }
}

/** Cancela todas as ordens abertas de um desafio. */
export async function cancelDesafioOrders(admin: any, desafioId: string) {
  const { data: openOrders } = await admin
    .from("orders")
    .select("*")
    .eq("desafio_id", desafioId)
    .in("status", ["open", "partial"]);

  for (const order of openOrders ?? []) {
    await admin.from("orders").update({ status: "expired" }).eq("id", order.id);
  }
}
