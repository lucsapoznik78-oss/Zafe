/**
 * POST /api/desafios/[id]/submeter-prova
 * Criador envia prova do resultado.
 * Claude avalia a prova:
 *   - Fraca (baixa confiança) → +24h (mantém awaiting_proof com novo deadline)
 *   - Aprovada → under_contestation (48h para bettors contestarem)
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface RouteParams { params: Promise<{ id: string }> }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function avaliarProva(
  title: string,
  description: string,
  proofUrl: string,
  proofType: string,
  proofNotes: string,
  claimedSide: string
): Promise<{ aprovado: boolean; confianca: number; motivo: string }> {
  try {
    const resp = await anthropic.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
        messages: [{
          role: "user",
          content: `Você é árbitro do Zafe, site brasileiro de prediction markets. Avalie se a prova do criador confirma o resultado do desafio.

DESAFIO: "${title}"
CRITÉRIOS DECLARADOS: "${description}"
RESULTADO ALEGADO: ${claimedSide.toUpperCase()}
TIPO DE PROVA: ${proofType}
URL DA PROVA: ${proofUrl}
NOTAS: ${proofNotes || "(nenhuma)"}

IMPORTANTE — LIMITAÇÕES TÉCNICAS:
- Você NÃO consegue visualizar imagens, fotos ou prints diretamente
- Para provas do tipo "foto" ou "print": só aprove se a URL levar a uma fonte pública verificável (ex: tweet público, Instagram público, post verificável) E você conseguir confirmar o conteúdo via busca na web
- Para links de notícia/resultado oficial: faça busca na web para verificar se a URL existe e confirma o resultado
- Para vídeos (YouTube, etc.): busque o título/conteúdo do vídeo na web

CRITÉRIOS PARA APROVAR (todos devem ser satisfeitos):
1. A URL é acessível e real (não é link privado, drive pessoal, ou URL inválida)
2. A fonte é de domínio reconhecível e confiável para este tipo de evento
3. Você consegue confirmar independentemente (via busca) que o resultado ocorreu
4. O resultado confirmado bate com os critérios declarados no desafio
5. Confiança final >= 85

CRITÉRIOS PARA REJEITAR:
- URL inacessível, privada ou suspeita
- Foto/print sem confirmação independente via busca
- Fonte não confiável ou facilmente manipulável
- Resultado ambíguo ou que não atende exatamente os critérios
- Qualquer dúvida → REJEITAR (protege os apostadores)

Faça a busca web agora para verificar.

Responda SOMENTE com JSON:
{"aprovado":true,"confianca":90,"motivo":"Notícia do UOL Esportes confirma que Flamengo venceu o Brasileirão em 15/12/2026"}`,
        }],
      },
      { headers: { "anthropic-beta": "web-search-2025-03-05" } }
    );
    const textBlock = resp.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
    const text = textBlock?.text ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const m = clean.match(/\{[\s\S]*?\}/);
    const parsed = JSON.parse(m?.[0] ?? clean);
    return {
      aprovado: parsed.aprovado === true,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 0,
      motivo: typeof parsed.motivo === "string" ? parsed.motivo : "",
    };
  } catch (e) {
    console.error("[submeter-prova] AI error:", e);
    return { aprovado: false, confianca: 0, motivo: "Erro ao avaliar prova automaticamente" };
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id: desafioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { proof_url, proof_type, proof_notes, claimed_side } = await req.json();

  if (!proof_url?.trim()) {
    return NextResponse.json({ error: "URL/link da prova é obrigatório" }, { status: 400 });
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

  // Salva a prova
  await admin.from("desafios").update({
    status: "proof_submitted",
    proof_url: proof_url.trim(),
    proof_type,
    proof_notes: proof_notes?.trim() ?? null,
    proof_submitted_at: new Date().toISOString(),
    resolution: claimed_side,
  }).eq("id", desafioId);

  // Avalia a prova via AI
  const avaliacao = await avaliarProva(
    desafio.title,
    desafio.description,
    proof_url.trim(),
    proof_type,
    proof_notes ?? "",
    claimed_side
  );

  if (avaliacao.aprovado) {
    // Prova aprovada → janela de contestação 48h
    const contestDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "under_contestation",
      contestation_deadline_at: contestDeadline,
      oracle_notes: `Prova aprovada pela AI (${avaliacao.confianca}%): ${avaliacao.motivo}`,
    }).eq("id", desafioId);

    return NextResponse.json({
      outcome: "approved",
      message: "Prova aprovada! Aguardando 48h para possíveis contestações.",
      motivo: avaliacao.motivo,
    });
  } else {
    // Prova fraca → +24h para enviar nova prova
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin.from("desafios").update({
      status: "awaiting_proof",
      proof_url: null,
      proof_type: null,
      proof_notes: null,
      proof_submitted_at: null,
      resolution: null,
      proof_deadline_at: newDeadline,
      oracle_notes: `Prova rejeitada (${avaliacao.confianca}%): ${avaliacao.motivo}`,
    }).eq("id", desafioId);

    // Notifica criador
    await admin.from("notifications").insert({
      user_id: desafio.creator_id,
      type: "market_resolved",
      title: "Prova insuficiente",
      body: `Sua prova para "${desafio.title?.slice(0, 50)}" foi rejeitada: ${avaliacao.motivo}. Você tem +24h para enviar outra.`,
      data: { desafio_id: desafioId },
    });

    return NextResponse.json({
      outcome: "rejected",
      message: "Prova insuficiente. Você tem mais 24h para enviar uma prova mais sólida.",
      motivo: avaliacao.motivo,
    });
  }
}
