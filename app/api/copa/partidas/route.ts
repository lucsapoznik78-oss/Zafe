import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition, getMatches, getUserPredictions } from "@/lib/copa/queries";

// GET /api/copa/partidas?stage=group&group=A — fixture + meus palpites
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const competition = await getCompetition(supabase);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") ?? undefined;
  const group = url.searchParams.get("group") ?? undefined;

  const [matches, predictions] = await Promise.all([
    getMatches(supabase, competition.id, { stage, group }),
    getUserPredictions(supabase, competition.id, user.id),
  ]);

  const byMatch = new Map(predictions.map((p) => [p.match_id, p]));

  return NextResponse.json({
    matches: matches.map((m) => ({ ...m, my_prediction: byMatch.get(m.id) ?? null })),
  });
}
