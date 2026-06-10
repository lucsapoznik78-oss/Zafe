import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition, getLeaderboard } from "@/lib/copa/queries";

// GET /api/copa/ranking — leaderboard com desempate
// (pontos > placares exatos > acertos de vencedor > ordem de entrada)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const competition = await getCompetition(supabase);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }

  const leaderboard = await getLeaderboard(supabase, competition.id);
  return NextResponse.json({ leaderboard, pot_total: competition.pot_total });
}
