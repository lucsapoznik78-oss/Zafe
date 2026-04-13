/**
 * POST /api/desafios/[id]/resolver
 * Tenta resolver o desafio via AI oracle (Claude com web search).
 * Chamado automaticamente quando o prazo expira.
 * Se incerto → muda para awaiting_proof e notifica criador.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { oracleAITripleCheck } from "@/lib/oracles/ai-triple-check";
import { pagarDesafio, notificarContestacao } from "@/lib/desafios-payout";
import { sendPushToUser } from "@/lib/webpush";

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const admin = createAdminClient();

  const { data: desafio } = await admin
    .from("desafios")
    .select("id, title, description, closes_at, status, creator_id, oracle_attempted, proof_deadline_at")
    .eq("id", desafioId)
    .single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  if (!["active", "resolving"].includes(desafio.status)) {
    return NextResponse.json({ error: "Desafio não está aguardando resolução" }, { status: 400 });
  }
  if (new Date(desafio.closes_at) > new Date()) {
    return NextResponse.json({ error: "Prazo ainda não encerrado" }, { status: 400 });
  }

  // Marca como resolving e tenta AI
  await admin.from("desafios").update({ status: "resolving", oracle_attempted: true }).eq("id", desafioId);

  let aiResult: Awaited<ReturnType<typeof oracleAITripleCheck>> | null = null;
  try {
    aiResult = await oracleAITripleCheck(desafio.title, desafio.closes_at);
  } catch (e) {
    console.error("[desafios/resolver] AI error:", e);
  }

  if (aiResult && aiResult.resultado !== "INCERTO") {
    const resolution = aiResult.resultado.toLowerCase() as "sim" | "nao";
    await admin.from("desafios").update({
      oracle_result: aiResult.resultado,
      oracle_notes: `check1: ${aiResult.check1.fonte} check2: ${aiResult.check2.fonte}`,
    }).eq("id", desafioId);

    // Resolve diretamente com janela de contestação 48h
    const contestDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "under_contestation",
      resolution,
      contestation_deadline_at: contestDeadline,
    }).eq("id", desafioId);

    // Notifica todos os apostadores sobre o resultado e janela de contestação
    notificarContestacao(admin, desafioId, desafio.title, resolution, contestDeadline).catch(console.error);

    return NextResponse.json({ outcome: "oracle_resolved", resolution });
  }

  // AI incerta → aguarda prova do criador (48h de prazo)
  const proofDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await admin.from("desafios").update({
    status: "awaiting_proof",
    proof_deadline_at: proofDeadline,
    oracle_result: "INCERTO",
    oracle_notes: aiResult ? `check1: ${aiResult.check1.fonte}` : "AI falhou",
  }).eq("id", desafioId);

  // Notifica criador
  await admin.from("notifications").insert({
    user_id: desafio.creator_id,
    type: "market_resolved",
    title: "Seu desafio precisa de prova",
    body: `"${desafio.title?.slice(0, 60)}": envie uma prova do resultado em até 48h.`,
    data: { desafio_id: desafioId },
  });
  sendPushToUser(admin, desafio.creator_id, {
    title: "Envie a prova do seu desafio",
    body: `"${desafio.title?.slice(0, 60)}": você tem 48h para enviar a prova.`,
    url: `/desafios/${desafioId}`,
  }).catch(() => {});

  return NextResponse.json({ outcome: "awaiting_proof" });
}
