/**
 * POST /api/desafios/[id]/contestar
 * Qualquer apostador pode contestar o resultado durante a janela de contestação.
 * Muda status para admin_review.
 *
 * GET /api/desafios/[id]/contestar
 * Executa finalização automática se janela de contestação expirou sem contestações.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pagarDesafio } from "@/lib/desafios-payout";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { reason } = await req.json();
  if (!reason?.trim() || reason.trim().length < 10) {
    return NextResponse.json({ error: "Forneça um motivo claro (mínimo 10 caracteres)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: desafio } = await admin
    .from("desafios")
    .select("id, title, status, creator_id, contestation_deadline_at, resolution")
    .eq("id", desafioId)
    .single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  if (desafio.status !== "under_contestation") {
    return NextResponse.json({ error: "Este desafio não está em período de contestação" }, { status: 400 });
  }
  if (new Date(desafio.contestation_deadline_at) < new Date()) {
    return NextResponse.json({ error: "Prazo de contestação encerrado" }, { status: 400 });
  }

  // Verifica se o usuário tem aposta neste desafio
  const { data: bets } = await admin
    .from("desafio_bets")
    .select("id")
    .eq("desafio_id", desafioId)
    .eq("user_id", user.id)
    .neq("status", "refunded")
    .limit(1);

  if (!bets || bets.length === 0) {
    return NextResponse.json({ error: "Apenas apostadores podem contestar o resultado" }, { status: 403 });
  }

  // Registra contestação (UNIQUE constraint previne duplicata)
  const { error: contestErr } = await admin.from("desafio_contestations").insert({
    desafio_id: desafioId,
    contestant_id: user.id,
    reason: reason.trim(),
  });

  if (contestErr) {
    if (contestErr.code === "23505") {
      return NextResponse.json({ error: "Você já contestou este resultado" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao registrar contestação" }, { status: 500 });
  }

  // Muda para admin_review
  await admin.from("desafios").update({ status: "admin_review" }).eq("id", desafioId);

  // Notifica Zafe admin (via notifications para todos os admins)
  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
  if (admins && admins.length > 0) {
    await admin.from("notifications").insert(
      admins.map((a: any) => ({
        user_id: a.id,
        type: "market_resolved",
        title: "Contestação recebida",
        body: `Desafio "${desafio.title?.slice(0, 50)}" foi contestado e precisa de revisão admin.`,
        data: { desafio_id: desafioId },
      }))
    );
  }

  return NextResponse.json({ outcome: "under_review", message: "Contestação enviada. A Zafe irá revisar." });
}

// Finaliza automaticamente se janela expirou sem contestações
export async function GET(_req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const admin = createAdminClient();

  const { data: desafio } = await admin
    .from("desafios")
    .select("id, status, resolution, contestation_deadline_at")
    .eq("id", desafioId)
    .single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  if (desafio.status !== "under_contestation") {
    return NextResponse.json({ note: "not_in_contestation" });
  }
  if (new Date(desafio.contestation_deadline_at) > new Date()) {
    return NextResponse.json({ note: "contestation_still_open" });
  }

  // Janela expirada sem contestações → pagar
  const resolution = desafio.resolution as "sim" | "nao";
  if (!resolution) {
    return NextResponse.json({ error: "Resolução não definida" }, { status: 500 });
  }

  await pagarDesafio(admin, desafioId, resolution, "oracle");
  return NextResponse.json({ outcome: "paid", resolution });
}
