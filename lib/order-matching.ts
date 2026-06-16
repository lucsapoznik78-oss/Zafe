/**
 * Engine de matching do mercado secundário Zafe.
 *
 * Modelo: ordens limitadas com prioridade preço-tempo (FIFO).
 * Preço = probabilidade implícita [0.01, 0.99] — ex: 0.65 = 65¢ por Z$1 de face value.
 * Quantidade = Z$ de face value da posição negociada.
 *
 * Sem comissão de plataforma — o vendedor recebe 100% do valor negociado.
 * O comprador paga exatamente o preço da ordem de venda (preço do maker).
 * Excesso de escrow do comprador é devolvido se executou abaixo do limite.
 */

import { creditBalance } from "@/lib/wallet";

export const COMMISSION_RATE = 0; // sem comissão de plataforma

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

    const ok = await executeTrade(admin, {
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

    // Trade não aconteceu (revertido ou fill_conflict por corrida): a RPC não
    // atualizou nenhum fill, então só seguimos para a próxima contra-ordem.
    if (!ok) continue;

    // Os fills das DUAS ordens já foram gravados atomicamente dentro de
    // execute_trade (migration 043, audit G10) — nada a atualizar aqui.
    remaining = parseFloat((remaining - matchQty).toFixed(2));
    totalFilled = parseFloat((totalFilled + matchQty).toFixed(2));
    tradesExecuted++;
  }

  return { tradesExecuted, totalFilled };
}

/**
 * Executa um trade via RPC `execute_trade` (migration 033, audit H3):
 * registro do trade, crédito do vendedor, reembolso de escrow, baixa da
 * posição vendida e criação da posição do comprador numa ÚNICA transação
 * Postgres — uma falha no meio reverte tudo (conservação de Z$).
 * Retorna false se o trade não aconteceu (caller não deve atualizar fills).
 */
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
}): Promise<boolean> {
  const { data, error } = await admin.rpc("execute_trade", {
    p_topic:      p.topicId ?? null,
    p_desafio:    p.desafioId ?? null,
    p_side:       p.side,
    p_buy_order:  p.buyOrderId,
    p_sell_order: p.sellOrderId,
    p_buyer:      p.buyerId,
    p_seller:     p.sellerId,
    p_price:      p.price,
    p_quantity:   p.quantity,
    p_buy_limit:  p.buyLimitPrice,
    p_source_bet: p.sourceBetId ?? null,
  });

  if (error || data?.status !== "ok") {
    console.error("[order-matching] execute_trade falhou", error ?? data);
    return false;
  }

  // Notificações só após o trade confirmado (não-bloqueantes).
  const notifData = p.desafioId ? { desafio_id: p.desafioId } : { topic_id: p.topicId };
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

  return true;
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
    await refundBuyOrderEscrow(admin, order);
  }
}

/**
 * Devolve o escrow não executado de uma ordem BUY.
 * Ordens SELL não têm escrow (o vendedor detém a posição, não Z$).
 */
async function refundBuyOrderEscrow(admin: any, order: any) {
  if (order.order_type !== "buy") return;
  const unfilled = parseFloat((order.quantity - order.filled_qty).toFixed(2));
  const refund = parseFloat((unfilled * order.price).toFixed(2));
  if (refund <= 0.01) return;

  await creditBalance(admin, order.user_id, refund);
  await admin.from("transactions").insert({
    user_id:      order.user_id,
    type:         "bet_refund",
    amount:       refund,
    net_amount:   refund,
    description:  "Ordem de compra cancelada — escrow devolvido",
    reference_id: order.topic_id ?? order.desafio_id ?? "",
  });
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
    await refundBuyOrderEscrow(admin, order);
  }
}
