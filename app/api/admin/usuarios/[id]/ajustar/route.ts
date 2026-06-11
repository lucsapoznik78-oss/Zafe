/**
 * POST /api/admin/usuarios/[id]/ajustar
 *
 * Ajuste manual de Z$ (audit #21). Body: { amount: number, motivo: string }.
 * amount > 0 credita, amount < 0 debita (CAS via lib/wallet — nunca negativa
 * a carteira). Sempre registra uma transação `manual_adjustment` auditável.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { adjustBalance } from "@/lib/wallet";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const amount = Number(body.amount);
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";

  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) {
    return NextResponse.json({ error: "Valor inválido (±Z$ 0,01 a 100.000)" }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "Informe o motivo do ajuste" }, { status: 400 });
  }

  const admin = createAdminClient();
  const delta = parseFloat(amount.toFixed(2));
  const result = await adjustBalance(admin, id, delta);

  if (!result.ok) {
    const msg =
      result.reason === "insufficient" ? "Saldo insuficiente para debitar este valor"
      : result.reason === "missing" ? "Carteira não encontrada"
      : "Conflito de concorrência — tente novamente";
    return NextResponse.json({ error: msg }, { status: result.reason === "conflict" ? 409 : 400 });
  }

  await admin.from("transactions").insert({
    user_id: id,
    type: "manual_adjustment",
    amount: delta,
    net_amount: delta,
    description: `Ajuste manual (admin): ${motivo.slice(0, 120)}`,
    reference_id: user.id, // admin que fez o ajuste
  });

  return NextResponse.json({ success: true, balance: result.balance });
}
