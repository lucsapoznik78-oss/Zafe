import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getMatchPredictions } from "@/lib/copa/queries";

// GET /api/copa/partidas/[id] — detalhe da partida.
// Palpites dos outros só após o kickoff (server-side + RLS).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: match } = await supabase
    .from("copa_matches")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!match) {
    return NextResponse.json({ error: "Partida não encontrada" }, { status: 404 });
  }

  const kickedOff = new Date(match.kickoff_at).getTime() <= Date.now();

  // Antes do kickoff, só o próprio palpite (a RLS também bloqueia os demais;
  // o filtro aqui é cinto-e-suspensório).
  const predictions = kickedOff
    ? await getMatchPredictions(supabase, match.id)
    : (await getMatchPredictions(supabase, match.id)).filter(
        (p) => p.user_id === user.id
      );

  return NextResponse.json({ match, predictions, kicked_off: kickedOff });
}
