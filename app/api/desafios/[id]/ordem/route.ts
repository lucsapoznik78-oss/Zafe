/**
 * POST /api/desafios/[id]/ordem
 *
 * Coloca uma ordem no mercado secundário de um desafio.
 * Mesma lógica de /api/topicos/[id]/ordem, mas valida contra desafios + desafio_bets.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { tryMatchOrders } from "@/lib/order-matching";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { side, order_type, quantity, is_market, source_bet_id } = body;
  let { price } = body;

  if (!["sim", "nao"].includes(side))
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
  if (!["buy", "sell"].includes(order_type))
    return NextResponse.json({ error: "Tipo de ordem inválido" }, { status: 400 });
  if (!quantity || quantity < 1)
    return NextResponse.json({ error: "Quantidade mínima: Z$ 1,00" }, { status: 400 });

  if (is_market) {
    price = order_type === "buy" ? 0.99 : 0.01;
  }

  if (!price || price <= 0 || price >= 1)
    return NextResponse.json({ error: "Preço deve estar entre 0,01 e 0,99" }, { status: 400 });

  // Verificar desafio ativo
  const { data: desafio } = await admin.from("desafios")
    .select("status, closes_at, creator_id").eq("id", desafioId).single();

  if (!desafio || desafio.status !== "active")
    return NextResponse.json({ error: "Mercado inativo ou encerrado" }, { status: 400 });
  if (new Date(desafio.closes_at) < new Date())
    return NextResponse.json({ error: "O prazo deste desafio já encerrou" }, { status: 400 });

  // Impedir posição nos dois lados (BUY only)
  if (order_type === "buy") {
    const oppSide = side === "sim" ? "nao" : "sim";
    const { data: oppBets } = await admin.from("desafio_bets")
      .select("id")
      .eq("desafio_id", desafioId)
      .eq("user_id", user.id)
      .eq("side", oppSide)
      .not("status", "in", '("refunded","lost","exited")')
      .limit(1);
    if (oppBets && oppBets.length > 0)
      return NextResponse.json({
        error: `Você já tem posição ${oppSide.toUpperCase()} neste desafio. Não é permitido apostar nos dois lados.`,
      }, { status: 400 });
  }

  if (order_type === "sell") {
    if (!source_bet_id)
      return NextResponse.json({ error: "Informe a aposta a ser vendida" }, { status: 400 });

    const { data: bet } = await admin.from("desafio_bets")
      .select("id, user_id, side, amount, status")
      .eq("id", source_bet_id).single();

    if (!bet || bet.user_id !== user.id)
      return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
    if (bet.side !== side)
      return NextResponse.json({ error: "Lado da aposta não corresponde à ordem" }, { status: 400 });
    if (!["matched"].includes(bet.status))
      return NextResponse.json({ error: "Aposta não está ativa" }, { status: 400 });

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
    const needed = parseFloat((price * quantity).toFixed(2));
    const { data: wallet } = await supabase.from("wallets")
      .select("balance").eq("user_id", user.id).single();
    if (!wallet || wallet.balance < needed)
      return NextResponse.json({
        error: `Saldo insuficiente. Necessário: Z$ ${needed.toFixed(2)}`,
      }, { status: 400 });
  }

  const { data: order, error: orderErr } = await admin.from("orders").insert({
    desafio_id:    desafioId,
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
    return NextResponse.json({ error: "Erro ao criar ordem" }, { status: 500 });
  }

  const matchResult = await tryMatchOrders(admin, order.id, desafioId);

  if (matchResult.tradesExecuted === 0) {
    const { data: existingOrders } = await admin
      .from("orders")
      .select("id")
      .eq("desafio_id", desafioId)
      .in("status", ["open", "partial"])
      .neq("id", order.id)
      .limit(50);
    for (const existing of existingOrders ?? []) {
      await tryMatchOrders(admin, existing.id, desafioId);
    }
  }

  if (is_market && matchResult.totalFilled < quantity - 0.01) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
  }

  const { data: finalOrder } = await admin.from("orders").select("*").eq("id", order.id).single();

  return NextResponse.json({
    success: true,
    order:   finalOrder,
    trades_executed: matchResult.tradesExecuted,
    total_filled:    matchResult.totalFilled,
  });
}
