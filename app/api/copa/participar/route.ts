import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition } from "@/lib/copa/queries";

// POST /api/copa/participar — inscrição com buy-in de Z$ 400.
// Tudo atômico via função SQL copa_buy_in (débito + participante +
// pote + transaction numa única transação; service role only).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const competition = await getCompetition(supabase);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("copa_buy_in", {
    p_user: user.id,
    p_competition: competition.id,
  });

  if (error) {
    console.error("[copa/participar]", error);
    return NextResponse.json({ error: "Erro ao processar inscrição" }, { status: 500 });
  }

  if (!data?.ok) {
    switch (data?.reason) {
      case "insufficient":
        return NextResponse.json(
          { error: `Saldo insuficiente: a inscrição custa Z$ ${competition.buy_in}` },
          { status: 400 }
        );
      case "already_joined":
        return NextResponse.json(
          { error: "Você já está inscrito na Zafe Copa" },
          { status: 409 }
        );
      case "closed":
        return NextResponse.json(
          { error: "As inscrições da Zafe Copa estão encerradas" },
          { status: 400 }
        );
      default:
        return NextResponse.json({ error: "Erro ao processar inscrição" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, buy_in: data.buy_in });
}
