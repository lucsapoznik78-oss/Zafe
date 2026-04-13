/**
 * POST /api/desafios/[id]/contestar
 * Qualquer apostador pode contestar o resultado durante a janela de contestação.
 * Claude avalia se a contestação é legítima antes de escalar para admin_review.
 *
 * GET /api/desafios/[id]/contestar
 * Executa finalização automática se janela de contestação expirou sem contestações.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pagarDesafio } from "@/lib/desafios-payout";
import Anthropic from "@anthropic-ai/sdk";

interface RouteParams { params: Promise<{ id: string }> }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function avaliarContestacao(opts: {
  title: string;
  description: string;
  resolution: string;
  proofUrl: string | null;
  proofType: string | null;
  proofNotes: string | null;
  oracleNotes: string | null;
  contestReason: string;
}): Promise<{ legitima: boolean; confianca: number; motivo: string }> {
  const { title, description, resolution, proofUrl, proofType, proofNotes, oracleNotes, contestReason } = opts;

  const prompt = `Você é árbitro do Zafe, plataforma brasileira de prediction markets.
Avalie se a contestação abaixo é legítima ou frívola/má-fé.

DESAFIO: "${title}"
CRITÉRIOS: "${description}"
RESULTADO DECLARADO PELO CRIADOR: ${resolution.toUpperCase()}
TIPO DE PROVA: ${proofType ?? "não informado"}
URL DA PROVA: ${proofUrl ?? "não enviado"}
NOTAS DA PROVA: ${proofNotes ?? "nenhuma"}
AVALIAÇÃO DO ORÁCULO: ${oracleNotes ?? "não disponível"}

MOTIVO DA CONTESTAÇÃO: "${contestReason}"

CRITÉRIOS DE AVALIAÇÃO:
- Legítima: o motivo aponta uma inconsistência real, fraude, prova inválida, resultado errado, ou falta de evidência sólida
- Frívola/má-fé: o motivo é vago ("não concordo"), pessoal ("perdi e não aceito"), sem relação com o resultado, ou claramente infundado
- Em caso de dúvida → considere legítima (protege os apostadores)

Responda SOMENTE com JSON: {"legitima":true,"confianca":88,"motivo":"O contestador aponta que..."}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = resp.content.find((b) => b.type === "text")?.text ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const m = clean.match(/\{[\s\S]*?\}/);
    const parsed = JSON.parse(m?.[0] ?? clean);

    return {
      legitima: parsed.legitima === true,
      confianca: typeof parsed.confianca === "number" ? parsed.confianca : 50,
      motivo: typeof parsed.motivo === "string" ? parsed.motivo : "",
    };
  } catch (e) {
    console.error("[contestar] Claude error:", e);
    // Em caso de erro, deixa passar para admin revisar
    return { legitima: true, confianca: 0, motivo: "Erro ao avaliar — escalado para admin" };
  }
}

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
    .select("id, title, description, status, creator_id, contestation_deadline_at, resolution, proof_url, proof_type, proof_notes, oracle_notes")
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

  // Claude avalia se a contestação é legítima
  const avaliacao = await avaliarContestacao({
    title: desafio.title,
    description: desafio.description,
    resolution: desafio.resolution ?? "",
    proofUrl: desafio.proof_url,
    proofType: desafio.proof_type,
    proofNotes: desafio.proof_notes,
    oracleNotes: desafio.oracle_notes,
    contestReason: reason.trim(),
  });

  if (!avaliacao.legitima) {
    return NextResponse.json({
      outcome: "rejected",
      message: "Contestação rejeitada pela análise automática.",
      motivo: avaliacao.motivo,
      confianca: avaliacao.confianca,
    }, { status: 422 });
  }

  // Registra contestação (UNIQUE constraint previne duplicata)
  const { error: contestErr } = await admin.from("desafio_contestations").insert({
    desafio_id: desafioId,
    contestant_id: user.id,
    reason: reason.trim(),
    claude_verdict: avaliacao.motivo,
    claude_confianca: avaliacao.confianca,
  });

  if (contestErr) {
    if (contestErr.code === "23505") {
      return NextResponse.json({ error: "Você já contestou este resultado" }, { status: 400 });
    }
    // Se o erro for de coluna que não existe (claude_verdict/confianca), tenta sem esses campos
    const { error: contestErr2 } = await admin.from("desafio_contestations").insert({
      desafio_id: desafioId,
      contestant_id: user.id,
      reason: reason.trim(),
    });
    if (contestErr2) {
      if (contestErr2.code === "23505") {
        return NextResponse.json({ error: "Você já contestou este resultado" }, { status: 400 });
      }
      return NextResponse.json({ error: "Erro ao registrar contestação" }, { status: 500 });
    }
  }

  // Muda para admin_review
  await admin.from("desafios").update({ status: "admin_review" }).eq("id", desafioId);

  // Notifica admins
  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
  if (admins && admins.length > 0) {
    await admin.from("notifications").insert(
      admins.map((a: any) => ({
        user_id: a.id,
        type: "market_resolved",
        title: "Contestação legítima recebida",
        body: `Desafio "${desafio.title?.slice(0, 50)}" foi contestado (IA validou). Revisar.`,
        data: { desafio_id: desafioId },
      }))
    );
  }

  return NextResponse.json({
    outcome: "under_review",
    message: "Contestação validada e enviada para revisão da Zafe.",
    motivo: avaliacao.motivo,
  });
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
