import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// PATCH /api/admin/copa/partidas/[id] — operações de admin numa partida:
//  * fill_slot: preencher times de slot de mata-mata (1A vs 2B → times reais)
//  * postpone: adiar (novo kickoff_at; palpites mantidos, lock move junto)
//  * void: anular (jogo cancelado/WO) — zera a pontuação da partida
// Middleware já gate-a /api/admin/* em profiles.is_admin; revalidamos aqui.

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("fill_slot"),
    home_team: z.string().min(2).max(40),
    away_team: z.string().min(2).max(40),
  }),
  z.object({
    action: z.literal("postpone"),
    kickoff_at: z.string().datetime({ offset: true }),
  }),
  z.object({ action: z.literal("void") }),
]);

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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
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

  if (body.action === "fill_slot") {
    if (match.status === "finished") {
      return NextResponse.json({ error: "Partida já finalizada" }, { status: 400 });
    }
    const { error } = await admin
      .from("copa_matches")
      .update({ home_team: body.home_team, away_team: body.away_team })
      .eq("id", match.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "postpone") {
    if (match.status === "finished" || match.status === "void") {
      return NextResponse.json({ error: "Partida já encerrada" }, { status: 400 });
    }
    // Palpites são mantidos; o deadline acompanha o novo kickoff.
    const { error } = await admin
      .from("copa_matches")
      .update({ kickoff_at: body.kickoff_at, status: "postponed" })
      .eq("id", match.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // void: anula a partida e remove qualquer pontuação já aplicada
  const { error: eVoid } = await admin
    .from("copa_matches")
    .update({
      status: "void",
      home_goals: null,
      away_goals: null,
      went_to_et: null,
      went_to_pens: null,
      advanced_side: null,
      resolved_at: null,
    })
    .eq("id", match.id);
  if (eVoid) return NextResponse.json({ error: eVoid.message }, { status: 500 });

  const { error: eScore } = await admin.rpc("copa_rescore_match", {
    p_match: match.id,
    p_events: [],
  });
  if (eScore) return NextResponse.json({ error: eScore.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
