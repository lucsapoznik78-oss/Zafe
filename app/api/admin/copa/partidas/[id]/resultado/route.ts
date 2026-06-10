import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyMatchResult } from "@/lib/copa/resolve";
import { isKnockout } from "@/lib/copa/types";
import type { CopaMatch } from "@/lib/copa/types";

// POST /api/admin/copa/partidas/[id]/resultado — resultado manual.
// Usado para: resolver partidas em under_review (fallback do oráculo) e
// CORRIGIR resultados já aplicados (reversão). copa_rescore_match apaga e
// reaplica os eventos atomicamente — nunca duplica pontos.
// Semântica do placar: fim do jogo INCLUINDO prorrogação, SEM pênaltis.

const goals = z.number().int().min(0).max(20);

const bodySchema = z
  .object({
    home_goals: goals,
    away_goals: goals,
    went_to_et: z.boolean().default(false),
    went_to_pens: z.boolean().default(false),
    advanced_side: z.enum(["home", "away"]).nullish(),
    source_url: z.string().url().nullish(),
  })
  .refine((b) => !b.went_to_pens || b.went_to_et, {
    message: "Pênaltis implicam prorrogação",
  });

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin === true ? user : null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Resultado inválido" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: match } = await admin
    .from("copa_matches")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!match) {
    return NextResponse.json({ error: "Partida não encontrada" }, { status: 404 });
  }
  const m = match as CopaMatch;

  if (m.status === "void") {
    return NextResponse.json({ error: "Partida anulada não pontua" }, { status: 400 });
  }
  if (!m.home_team || !m.away_team) {
    return NextResponse.json({ error: "Defina os times antes do resultado" }, { status: 400 });
  }
  if (new Date(m.kickoff_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "A partida ainda não começou" }, { status: 400 });
  }

  // Validações de consistência por fase
  if (isKnockout(m.stage)) {
    if (!body.advanced_side) {
      return NextResponse.json(
        { error: "Mata-mata exige o classificado (advanced_side)" },
        { status: 400 }
      );
    }
    if (body.home_goals === body.away_goals && !body.went_to_pens) {
      return NextResponse.json(
        { error: "Empate no mata-mata exige pênaltis" },
        { status: 400 }
      );
    }
    if (!body.went_to_pens) {
      const byScore = body.home_goals > body.away_goals ? "home" : "away";
      if (byScore !== body.advanced_side) {
        return NextResponse.json(
          { error: "Sem pênaltis, o classificado deve bater com o placar" },
          { status: 400 }
        );
      }
    }
  } else {
    if (body.went_to_et || body.went_to_pens) {
      return NextResponse.json(
        { error: "Fase de grupos não tem prorrogação/pênaltis" },
        { status: 400 }
      );
    }
  }

  const isCorrection = m.status === "finished";

  const result = await applyMatchResult(admin, m, {
    home_goals: body.home_goals,
    away_goals: body.away_goals,
    went_to_et: body.went_to_et,
    went_to_pens: body.went_to_pens,
    advanced_side: isKnockout(m.stage) ? body.advanced_side! : null,
    source_url: body.source_url ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Erro ao aplicar resultado" }, { status: 500 });
  }

  // Auditoria: correção de resultado já resolvido fica registrada
  await admin.from("copa_resolution_log").insert({
    match_id: m.id,
    attempt: 1,
    model: null,
    raw_response: JSON.stringify({ manual: true, by: user.id, body }),
    parsed: body,
    confidence: null,
    source_url: body.source_url ?? null,
    outcome: isCorrection ? "reversed" : "applied",
  });

  return NextResponse.json({ success: true, events: result.events, correction: isCorrection });
}
