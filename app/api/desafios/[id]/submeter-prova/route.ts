/**
 * POST /api/desafios/[id]/submeter-prova
 *
 * Fluxo:
 *   1. Servidor prepara a prova (proof-processor): baixa imagem, extrai HTML,
 *      chama Google Vision, etc. Claude só recebe conteúdo pronto.
 *   2. Claude (claude-sonnet-4-6) analisa com visão se houver imagem, ou texto se for link.
 *   3. Aprovado → under_contestation (48h); Rejeitado → +24h para nova prova.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { processProof } from "@/lib/proof-processor";
import { notificarContestacao } from "@/lib/desafios-payout";
import { sendPushToUser } from "@/lib/webpush";

interface RouteParams { params: Promise<{ id: string }> }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function avaliarProva(opts: {
  title: string;
  description: string;
  claimedSide: string;
  proofType: string;
  processed: Awaited<ReturnType<typeof processProof>>;
}): Promise<{ aprovado: boolean; confianca: number; motivo: string }> {
  const { title, description, claimedSide, proofType, processed } = opts;

  const systemText = `Você é árbitro do Zafe, plataforma brasileira de prediction markets.
Avalie se a prova confirma o resultado declarado pelo criador.

DESAFIO: "${title}"
CRITÉRIOS: "${description}"
RESULTADO ALEGADO: ${claimedSide.toUpperCase()}
TIPO DE PROVA: ${proofType}
MÉTODO DE VERIFICAÇÃO: ${processed.method}
${processed.visionSummary ? `\nGOOGLE VISION:\n${processed.visionSummary}` : ""}

REGRAS DE AVALIAÇÃO:
- Aprovado (aprovado=true): prova confirma inequivocamente o resultado com confiança >= 85
- Rejeitado: prova ambígua, manipulável, não relacionada, ou confiança < 85
- Para fotos: confie mais no Google Vision do que na imagem isolada
- Para links: o texto da página deve mencionar explicitamente o resultado
- Para vídeos: o título e thumbnail devem ser consistentes com o resultado
- Em caso de dúvida → REJEITE (protege os apostadores)

Responda SOMENTE com JSON: {"aprovado":true,"confianca":92,"motivo":"Texto da ESPN confirma que..."}`;

  try {
    let content: Anthropic.MessageParam["content"];

    if (processed.images && processed.images.length > 0) {
      // Claude com visão — manda texto + imagem(s)
      content = [
        { type: "text", text: systemText },
        ...processed.images.map((img) => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: img.b64,
          },
        })),
        {
          type: "text",
          text: `Analise a(s) imagem(ns) acima junto com os dados do Google Vision.\nConteúdo adicional: ${processed.summary}`,
        },
      ];
    } else {
      // Só texto
      content = `${systemText}\n\nCONTEÚDO VERIFICADO:\n${processed.summary}`;
    }

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content }],
    });

    const text = resp.content.find((b) => b.type === "text")?.text ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const m = clean.match(/\{[\s\S]*?\}/);
    const parsed = JSON.parse(m?.[0] ?? clean);

    return {
      aprovado: parsed.aprovado === true,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0,
      motivo: typeof parsed.motivo === "string" ? parsed.motivo : "",
    };
  } catch (e) {
    console.error("[submeter-prova] Claude error:", e);
    return { aprovado: false, confianca: 0, motivo: "Erro interno ao avaliar — tente novamente" };
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { proof_url, proof_type, proof_notes, claimed_side, raw_image_base64 } = body;

  if (!proof_url?.trim() && !raw_image_base64) {
    return NextResponse.json({ error: "URL ou imagem da prova é obrigatório" }, { status: 400 });
  }
  if (!["link", "foto", "video", "resultado_oficial"].includes(proof_type)) {
    return NextResponse.json({ error: "Tipo de prova inválido" }, { status: 400 });
  }
  if (claimed_side !== "sim" && claimed_side !== "nao") {
    return NextResponse.json({ error: "Resultado inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: desafio } = await admin
    .from("desafios")
    .select("id, title, description, status, creator_id, proof_deadline_at")
    .eq("id", desafioId)
    .single();

  if (!desafio) return NextResponse.json({ error: "Desafio não encontrado" }, { status: 404 });
  if (desafio.creator_id !== user.id) {
    return NextResponse.json({ error: "Apenas o criador pode enviar prova" }, { status: 403 });
  }
  if (desafio.status !== "awaiting_proof") {
    return NextResponse.json({ error: "Este desafio não está aguardando prova" }, { status: 400 });
  }
  if (new Date(desafio.proof_deadline_at) < new Date()) {
    return NextResponse.json({ error: "Prazo de envio de prova expirado" }, { status: 400 });
  }

  // Marca como "processando" para evitar duplo envio
  await admin.from("desafios").update({
    status: "proof_submitted",
    proof_url: proof_url?.trim() ?? "(upload direto)",
    proof_type,
    proof_notes: proof_notes?.trim() ?? null,
    proof_submitted_at: new Date().toISOString(),
    resolution: claimed_side,
  }).eq("id", desafioId);

  // ── Processa a prova server-side ───────────────────────────────
  const processed = await processProof(
    proof_url?.trim() ?? "",
    proof_type,
    raw_image_base64 ?? undefined
  );

  // Se nem conseguiu baixar/acessar → rejeita direto
  if (!processed.canVerify) {
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "awaiting_proof",
      proof_url: null, proof_type: null, proof_notes: null,
      proof_submitted_at: null, resolution: null,
      proof_deadline_at: newDeadline,
      oracle_notes: `Prova inacessível: ${processed.error}`,
    }).eq("id", desafioId);
    return NextResponse.json({
      outcome: "rejected",
      message: `Não foi possível acessar a prova: ${processed.error}. Você tem +24h para enviar outra.`,
      motivo: processed.error,
    });
  }

  // ── Claude avalia ──────────────────────────────────────────────
  const avaliacao = await avaliarProva({
    title: desafio.title,
    description: desafio.description,
    claimedSide: claimed_side,
    proofType: proof_type,
    processed,
  });

  if (avaliacao.aprovado) {
    const contestDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "under_contestation",
      contestation_deadline_at: contestDeadline,
      oracle_notes: `[${processed.method}] Aprovado (${avaliacao.confianca}%): ${avaliacao.motivo}`,
    }).eq("id", desafioId);

    // Notifica todos os apostadores sobre o resultado e janela de contestação
    notificarContestacao(admin, desafioId, desafio.title, claimed_side, contestDeadline).catch(console.error);

    return NextResponse.json({
      outcome: "approved",
      message: "Prova aprovada! Aguardando 48h para possíveis contestações.",
      motivo: avaliacao.motivo,
      confianca: avaliacao.confianca,
    });
  } else {
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "awaiting_proof",
      proof_url: null, proof_type: null, proof_notes: null,
      proof_submitted_at: null, resolution: null,
      proof_deadline_at: newDeadline,
      oracle_notes: `[${processed.method}] Rejeitado (${avaliacao.confianca}%): ${avaliacao.motivo}`,
    }).eq("id", desafioId);

    await Promise.allSettled([
      admin.from("notifications").insert({
        user_id: desafio.creator_id,
        type: "market_resolved",
        title: "Prova insuficiente",
        body: `Prova rejeitada: ${avaliacao.motivo}. Você tem +24h para enviar outra mais sólida.`,
        data: { desafio_id: desafioId },
      }),
      sendPushToUser(admin, desafio.creator_id, {
        title: "Prova rejeitada",
        body: `Envie uma prova mais sólida. Você tem mais 24h.`,
        url: `/desafios/${desafioId}`,
      }),
    ]);

    return NextResponse.json({
      outcome: "rejected",
      message: "Prova insuficiente. Você tem mais 24h para enviar uma prova mais sólida.",
      motivo: avaliacao.motivo,
      confianca: avaliacao.confianca,
    });
  }
}
