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

  // ── Validação específica por tipo ─────────────────────────────────
  if (order_type === "sell") {
    if (!source_bet_id)
      return NextResponse.json({ error: "Informe a aposta a ser vendida" }, { status: 400 });

    // Verificar que o usuário possui esta aposta e ela é vendível
    const { data: bet } = await supabase.from("bets")
      .select("id, user_id, side, amount, status")
      .eq("id", source_bet_id).single();

    if (!bet || bet.user_id !== user.id)
      return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
    if (bet.side !== side)
      return NextResponse.json({ error: "Lado da aposta não corresponde à ordem" }, { status: 400 });
    if (!["pending", "matched", "partial"].includes(bet.status))
      return NextResponse.json({ error: "Aposta não está ativa" }, { status: 400 });

    // Verificar quantidade disponível (descontando ordens de venda já abertas)
    const { data: openSells } = await admin.from("orders")
      .select("quantity, filled_qty")
      .eq("source_bet_id", source_bet_id)
      .in("status", ["open", "partial"]);

    const alreadyListed = (openSells ?? []).reduce(
      (s: number, o: any) => s + (parseFloat(o.quantity) - parseFloat(o.filled_qty)), 0
    );
    const available = parseFloat(bet.amount) - alreadyListed;

    if (quantity > available + 0.01)
      return NextResponse.json({
        error: `Apenas Z$ ${available.toFixed(2)} disponíveis para venda nesta aposta`,
      }, { status: 400 });

  } else {
    // BUY: verificar saldo para escrow
    const escrow = parseFloat((price * quantity).toFixed(2));
    const { data: wallet } = await supabase.from("wallets")
      .select("balance").eq("user_id", user.id).single();

    if (!wallet || wallet.balance < escrow)
      return NextResponse.json({
        error: `Saldo insuficiente. Necessário: Z$ ${escrow.toFixed(2)} (escrow)`,
      }, { status: 400 });

    // Debitar escrow
    const { error: walletErr } = await supabase.from("wallets")
      .update({ balance: wallet.balance - escrow })
      .eq("user_id", user.id)
      .eq("balance", wallet.balance);

    if (walletErr)
      return NextResponse.json({ error: "Erro ao reservar saldo. Tente novamente." }, { status: 409 });
  }

  // ── Inserir ordem ─────────────────────────────────────────────────
  const { data: order, error: orderErr } = await admin.from("orders").insert({
    topic_id:      topicId,
    user_id:       user.id,
    side,
    order_type,
    price:         parseFloat(price.toFixed(4)),
    quantity:      parseFloat(quantity.toFixed(2)),
    filled_qty:    0,
    status:        "open",
    source_bet_id: order_type === "sell" ? source_bet_id : null,
  }).select().single();

  if (orderErr || !order) {
    // Estornar escrow se foi debitado
    if (order_type === "buy") {
      const escrow = parseFloat((price * quantity).toFixed(2));
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
      await supabase.from("wallets").update({ balance: (w?.balance ?? 0) + escrow }).eq("user_id", user.id);
    }
    return NextResponse.json({ error: "Erro ao criar ordem" }, { status: 500 });
  }

  // ── Tentar casar imediatamente ────────────────────────────────────
  const matchResult = await tryMatchOrders(admin, order.id);

  // Também varrer ordens antigas do mesmo tópico que ainda não se casaram.
  // Isso garante que ordens de usuários diferentes que já estavam no livro
  // se casem mesmo sem nova ordem ter sido colocada entre elas.
  if (matchResult.tradesExecuted === 0) {
    const { data: existingOrders } = await admin
      .from("orders")
      .select("id")
      .eq("topic_id", topicId)
      .in("status", ["open", "partial"])
      .neq("id", order.id)
      .limit(50);
    for (const existing of existingOrders ?? []) {
      await tryMatchOrders(admin, existing.id);
    }
  }

  // Ordem a mercado: cancelar o que não foi executado e devolver escrow
  if (is_market && matchResult.totalFilled < quantity - 0.01) {
    const { data: updatedOrder } = await admin.from("orders").select("filled_qty, price").eq("id", order.id).single();
    const unfilledQty = parseFloat((quantity - (updatedOrder?.filled_qty ?? 0)).toFixed(2));

    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);

    if (order_type === "buy" && unfilledQty > 0.01) {
      const refund = parseFloat((unfilledQty * price).toFixed(2));
      const { data: w } = await admin.from("wallets").select("balance").eq("user_id", user.id).single();
      await admin.from("wallets").update({ balance: (w?.balance ?? 0) + refund }).eq("user_id", user.id);
    }
  }

  // Estado final da ordem
  const { data: finalOrder } = await admin.from("orders").select("*").eq("id", order.id).single();

  return NextResponse.json({
    success: true,
    order:   finalOrder,
    trades_executed: matchResult.tradesExecuted,
    total_filled:    matchResult.totalFilled,
  });
}
