/**
 * DELETE /api/topicos/[id]/ordem/[orderId]
 * Cancela uma ordem aberta. Devolve escrow para ordens BUY.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams { params: Promise<{ id: string; orderId: string }> }

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { orderId } = await params;
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: order } = await admin.from("orders")
    .select("*").eq("id", orderId).single();

  if (!order) return NextResponse.json({ error: "Ordem não encontrada" }, { status: 404 });
  if (order.user_id !== user.id) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (!["open", "partial"].includes(order.status))
    return NextResponse.json({ error: "Ordem não pode ser cancelada" }, { status: 400 });

  // Cancelar primeiro para evitar race condition (somente 1 request consegue cancelar)
  const { count: cancelled } = await admin.from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .in("status", ["open", "partial"])
    .select("id", { count: "exact", head: true });

  if (!cancelled || cancelled === 0) {
    return NextResponse.json({ error: "Ordem já foi cancelada ou executada" }, { status: 409 });
  }

  // Devolver escrow de ordens BUY não executadas
  if (order.order_type === "buy") {
    const unfilledQty = parseFloat((order.quantity - order.filled_qty).toFixed(2));
    const refund = parseFloat((unfilledQty * order.price).toFixed(2));

    if (refund > 0.01) {
      const { data: wallet } = await supabase.from("wallets")
        .select("balance").eq("user_id", user.id).single();
      await supabase.from("wallets")
        .update({ balance: (wallet?.balance ?? 0) + refund })
        .eq("user_id", user.id);

      await supabase.from("transactions").insert({
        user_id:      user.id,
        type:         "bet_refund",
        amount:       refund,
        net_amount:   refund,
        description:  "Ordem de compra cancelada — escrow devolvido",
        reference_id: order.topic_id,
      });
    }
  }

  return NextResponse.json({ success: true });
}
