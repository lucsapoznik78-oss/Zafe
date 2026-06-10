import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition, getParticipant } from "@/lib/copa/queries";
import { predictionInputSchema } from "@/lib/copa/types";

// POST /api/copa/palpitar — cria/edita palpite de uma partida.
// Deadline e regras validados NO SERVIDOR (nunca confiar no client):
//  * só participante inscrito
//  * só até o kickoff (lock automático depois — cobre entrada tardia)
//  * só partida scheduled/postponed com os dois times definidos
//  * stage vem do BANCO, não do body (client não escolhe a regra)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const matchId = String(body?.match_id ?? "");
  if (!matchId) {
    return NextResponse.json({ error: "Partida inválida" }, { status: 400 });
  }

  const competition = await getCompetition(supabase);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }
  if (!["open", "running"].includes(competition.status)) {
    return NextResponse.json({ error: "A competição está encerrada" }, { status: 400 });
  }

  const participant = await getParticipant(supabase, competition.id, user.id);
  if (!participant) {
    return NextResponse.json(
      { error: "Inscreva-se na Zafe Copa para enviar previsões" },
      { status: 403 }
    );
  }

  const { data: match } = await supabase
    .from("copa_matches")
    .select("id, competition_id, stage, status, kickoff_at, home_team, away_team")
    .eq("id", matchId)
    .single();

  if (!match || match.competition_id !== competition.id) {
    return NextResponse.json({ error: "Partida não encontrada" }, { status: 404 });
  }
  if (!["scheduled", "postponed"].includes(match.status)) {
    return NextResponse.json(
      { error: "Esta partida não aceita previsões" },
      { status: 400 }
    );
  }
  if (!match.home_team || !match.away_team) {
    return NextResponse.json(
      { error: "Os times desta partida ainda não foram definidos" },
      { status: 400 }
    );
  }
  // Re-leitura do deadline no servidor — lock pós-kickoff
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Previsões encerradas: a partida já começou" },
      { status: 400 }
    );
  }

  // stage vem do banco; o resto do body é validado pelo zod
  const parsed = predictionInputSchema.safeParse({
    stage: match.stage,
    match_id: match.id,
    outcome_pick: body?.outcome_pick ?? undefined,
    qualifier_pick: body?.qualifier_pick ?? undefined,
    pred_home_goals: body?.pred_home_goals ?? null,
    pred_away_goals: body?.pred_away_goals ?? null,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Previsão inválida" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("copa_predictions").upsert(
    {
      competition_id: competition.id,
      match_id: match.id,
      participant_id: participant.id,
      user_id: user.id,
      outcome_pick: input.stage === "group" ? input.outcome_pick : null,
      qualifier_pick: input.stage === "group" ? null : input.qualifier_pick,
      pred_home_goals: input.pred_home_goals ?? null,
      pred_away_goals: input.pred_away_goals ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id,user_id" }
  );

  if (error) {
    console.error("[copa/palpitar]", error);
    return NextResponse.json({ error: "Erro ao salvar previsão" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
