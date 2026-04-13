/**
 * POST /api/admin/desafios/[id]/resolver
 * Admin resolve um desafio contestado.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pagarDesafio, reembolsarDesafio } from "@/lib/desafios-payout";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { resolution } = await req.json();
  if (!["sim", "nao", "refund"].includes(resolution)) {
    return NextResponse.json({ error: "Resolução inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: desafio } = await admin
    .from("desafios").select("status").eq("id", desafioId).single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  const resolvableStatuses = ["admin_review", "resolving", "under_contestation", "awaiting_proof", "proof_submitted"];
  if (!resolvableStatuses.includes(desafio.status)) {
    return NextResponse.json({ error: "Desafio já foi resolvido ou cancelado" }, { status: 400 });
  }

  if (resolution === "refund") {
    await reembolsarDesafio(admin, desafioId, "Contestação procedente — admin reembolsou", "admin");
  } else {
    await pagarDesafio(admin, desafioId, resolution as "sim" | "nao", "admin");
  }

  return NextResponse.json({ outcome: "resolved" });
}
