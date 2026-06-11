/**
 * POST /api/topicos/[id]/ordem
 *
 * Coloca uma ordem de compra ou venda no mercado secundário.
 *
 * Body:
 *  {
 *    side: "sim" | "nao"
 *    order_type: "buy" | "sell"
 *    price: number        // 0.01 – 0.99 (probabilidade implícita)
 *    quantity: number     // Z$ de face value
 *    is_market: boolean   // ordem a mercado (executa imediatamente ou cancela)
 *    source_bet_id?: string // obrigatório para sell
 *  }
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { tryMatchOrders } from "@/lib/order-matching";
import { debitBalance, creditBalance } from "@/lib/wallet";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { side, order_type, quantity, is_market, source_bet_id } = body;
  let { price } = body;

  // ── Validação básica ──────────────────────────────────────────────
  if (!["sim", "nao"].includes(side))
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
  if (!["buy", "sell"].includes(order_type))
    return NextResponse.json({ error: "Tipo de ordem inválido" }, { status: 400 });
  if (!quantity || quantity < 1)
    return NextResponse.json({ error: "Quantidade mínima: Z$ 1,00" }, { status: 400 });

  // Ordem a mercado: define preço agressivo para garantir execução imediata
  if (is_market) {
    price = order_type === "buy" ? 0.99 : 0.01;
  }

  if (!price || price <= 0 || price >= 1)
    return NextResponse.json({ error: "Preço deve estar entre 0,01 e 0,99" }, { status: 400 });

  // ── Verificar tópico ativo ────────────────────────────────────────
  const { data: topic } = await supabase.from("topics")
    .select("status, closes_at").eq("id", topicId).single();

  if (!topic || topic.status !== "active")
    return NextResponse.json({ error: "Mercado inativo ou encerrado" }, { status: 400 });
  if (new Date(topic.closes_at) < new Date())
    return NextResponse.json({ error: "O prazo deste mercado já encerrou" }, { status: 400 });

  // ── Impedir posição nos dois lados (BUY only) ────────────────────
  if (order_type === "buy") {
    const oppSide = side === "sim" ? "nao" : "sim";
    const { data: oppBets } = await supabase.from("bets")
      .select("id")
      .eq("topic_id", topicId)
      .eq("user_id", user.id)
      .eq("side", oppSide)
      .not("status", "in", '("refunded","lost","exited")')
      .limit(1);
    if (oppBets && oppBets.length > 0)
      return NextResponse.json({
        error: `Você já tem posição ${oppSide.toUpperCase()} neste mercado. Não é permitido apostar nos dois lados.`,
      }, { status: 400 });
  }

  // ── Criação da ordem por tipo ─────────────────────────────────────
  let orderId: string;

  if (order_type === "sell") {
    if (!source_bet_id)
      return NextResponse.json({ error: "Informe a aposta a ser vendida" }, { status: 400 });

    // RPC create_sell_order (migration 033, audit H4): tranca a aposta-fonte
    // (FOR UPDATE) e valida disponibilidade + insere a ordem na MESMA
    // transação — duas SELLs concorrentes não vendem a posição em dobro.
    const { data: sellResult, error: sellErr } = await admin.rpc("create_sell_order", {
      p_topic:      topicId,
      p_user:       user.id,
      p_side:       side,
      p_price:      parseFloat(price.toFixed(4)),
      p_quantity:   parseFloat(quantity.toFixed(2)),
      p_source_bet: source_bet_id,
    });

    if (sellErr || !sellResult) {
      console.error("[ordem] create_sell_order falhou", sellErr);
      return NextResponse.json({ error: "Erro ao criar ordem" }, { status: 500 });
    }

    switch (sellResult.status) {
      case "ok":
        break;
      case "not_found":
        return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
      case "side_mismatch":
        return NextResponse.json({ error: "Lado da aposta não corresponde à ordem" }, { status: 400 });
      case "not_active":
        return NextResponse.json({ error: "Aposta não está ativa" }, { status: 400 });
      case "insufficient":
        return NextResponse.json({
          error: `Apenas Z$ ${Number(sellResult.available ?? 0).toFixed(2)} disponíveis para venda nesta aposta`,
        }, { status: 400 });
      default:
        return NextResponse.json({ error: "Erro ao criar ordem" }, { status: 500 });
    }

    orderId = sellResult.order_id;

  } else {
    // BUY: debita o escrow (preço × quantidade) no momento da colocação.
    // Sem isso, várias ordens concorrentes apostam o mesmo saldo (double-spend).
    // Excesso é devolvido na execução (preço do maker ≤ limite) e o saldo não
    // executado é devolvido ao cancelar/expirar a ordem.
    const needed = parseFloat((price * quantity).toFixed(2));
    const debit = await debitBalance(admin, user.id, needed);
    if (!debit.ok)
      return NextResponse.json(
        {
          error: debit.reason === "insufficient"
            ? `Saldo insuficiente. Necessário: Z$ ${needed.toFixed(2)}`
            : "Erro ao reservar saldo. Tente novamente.",
        },
        { status: debit.reason === "insufficient" ? 400 : 409 },
      );

    await admin.from("transactions").insert({
      user_id:      user.id,
      type:         "bet_placed",
      amount:       needed,
      net_amount:   needed,
      description:  `Escrow ordem de compra ${side.toUpperCase()} · ${(price * 100).toFixed(1)}¢`,
      reference_id: topicId,
    });

    // Inserir ordem de compra
    const { data: order, error: orderErr } = await admin.from("orders").insert({
      topic_id:      topicId,
      user_id:       user.id,
      side,
      order_type,
      price:         parseFloat(price.toFixed(4)),
      quantity:      parseFloat(quantity.toFixed(2)),
      filled_qty:    0,
      status:        "open",
      source_bet_id: null,
    }).select().single();

    if (orderErr || !order) {
      // Reverter escrow caso a ordem de compra não tenha sido criada
      await creditBalance(admin, user.id, needed);
      return NextResponse.json({ error: "Erro ao criar ordem" }, { status: 500 });
    }

    orderId = order.id;
  }

  // ── Tentar casar imediatamente ────────────────────────────────────
  const matchResult = await tryMatchOrders(admin, orderId);

  // Também varrer ordens antigas do mesmo tópico que ainda não se casaram.
  // Isso garante que ordens de usuários diferentes que já estavam no livro
  // se casem mesmo sem nova ordem ter sido colocada entre elas.
  if (matchResult.tradesExecuted === 0) {
    const { data: existingOrders } = await admin
      .from("orders")
      .select("id")
      .eq("topic_id", topicId)
      .in("status", ["open", "partial"])
      .neq("id", orderId)
      .limit(50);
    for (const existing of existingOrders ?? []) {
      await tryMatchOrders(admin, existing.id);
    }
  }

  // Ordem a mercado: cancelar o que não foi executado e devolver o escrow
  // correspondente à quantidade não preenchida (apenas BUY tem escrow).
  if (is_market && matchResult.totalFilled < quantity - 0.01) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    if (order_type === "buy") {
      const unfilled = parseFloat((quantity - matchResult.totalFilled).toFixed(2));
      const refund = parseFloat((unfilled * price).toFixed(2));
      if (refund > 0.01) {
        await creditBalance(admin, user.id, refund);
        await admin.from("transactions").insert({
          user_id:      user.id,
          type:         "bet_refund",
          amount:       refund,
          net_amount:   refund,
          description:  "Ordem a mercado não executada — escrow devolvido",
          reference_id: topicId,
        });
      }
    }
  }

  // Estado final da ordem
  const { data: finalOrder } = await admin.from("orders").select("*").eq("id", orderId).single();

  return NextResponse.json({
    success: true,
    order:   finalOrder,
    trades_executed: matchResult.tradesExecuted,
    total_filled:    matchResult.totalFilled,
  });
}
