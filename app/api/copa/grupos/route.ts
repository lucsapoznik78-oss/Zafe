import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition, getMatches, getParticipant } from "@/lib/copa/queries";
import { groupLockAt, groupTeams } from "@/lib/copa/group-picks";
import { groupPickInputSchema } from "@/lib/copa/types";

// POST /api/copa/grupos — salva o palpite de classificação (1º/2º/3º)
// de um grupo. Regras validadas NO SERVIDOR:
//  * só participante inscrito
//  * as 3 seleções pertencem ao grupo e são distintas (zod + CHECK)
//  * editável até o kickoff da ÚLTIMA rodada do grupo
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = groupPickInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Palpite inválido" },
      { status: 400 }
    );
  }
  const input = parsed.data;

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

  const matches = await getMatches(supabase, competition.id, {
    stage: "group",
    group: input.group_name,
  });
  if (matches.length === 0) {
    return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
  }

  const teams = new Set(groupTeams(matches));
  for (const team of [input.first_team, input.second_team, input.third_team]) {
    if (!teams.has(team)) {
      return NextResponse.json(
        { error: `"${team}" não pertence ao Grupo ${input.group_name}` },
        { status: 400 }
      );
    }
  }

  const lockAt = groupLockAt(matches);
  if (!lockAt || new Date(lockAt).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Palpites encerrados: a última rodada do grupo já começou" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("copa_group_picks").upsert(
    {
      competition_id: competition.id,
      participant_id: participant.id,
      user_id: user.id,
      group_name: input.group_name,
      first_team: input.first_team,
      second_team: input.second_team,
      third_team: input.third_team,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id,user_id,group_name" }
  );

  if (error) {
    console.error("[copa/grupos]", error);
    return NextResponse.json({ error: "Erro ao salvar palpite" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
