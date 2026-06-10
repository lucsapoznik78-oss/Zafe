import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  getCompetition,
  getLeaderboard,
  getParticipant,
  getParticipantCount,
} from "@/lib/copa/queries";

// GET /api/copa — visão geral: competição, pote, minha inscrição e posição
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const competition = await getCompetition(supabase);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }

  const [participant, participantCount, leaderboard] = await Promise.all([
    getParticipant(supabase, competition.id, user.id),
    getParticipantCount(supabase, competition.id),
    getLeaderboard(supabase, competition.id),
  ]);

  const myRow = leaderboard.find((r) => r.user_id === user.id) ?? null;

  return NextResponse.json({
    competition,
    participant,
    participant_count: participantCount,
    my_position: myRow?.posicao ?? null,
    my_points: myRow?.points ?? null,
  });
}
