/**
 * Resumo semanal de desempenho (retenção): para cada usuário com palpites
 * resolvidos nos últimos 7 dias, envia notificação in-app + push com
 * acertos/erros e Z$ ganhos. Roda aos domingos (vercel.json).
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendPushToUser } from "@/lib/webpush";

// Vercel cron dispatch é GET; reaproveita o mesmo handler.
export const GET = POST;

export async function POST(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const umaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Tópicos resolvidos na última semana
  const { data: topics } = await supabase
    .from("topics")
    .select("id")
    .eq("status", "resolved")
    .gte("resolved_at", umaSemanaAtras);

  if (!topics?.length) {
    return NextResponse.json({ success: true, users: 0, note: "sem resoluções na semana" });
  }

  // Palpites decididos nesses tópicos
  const { data: bets } = await supabase
    .from("bets")
    .select("user_id, status, potential_payout")
    .in("topic_id", topics.map((t) => t.id))
    .in("status", ["won", "lost"]);

  if (!bets?.length) {
    return NextResponse.json({ success: true, users: 0, note: "sem palpites decididos" });
  }

  // Agrega por usuário
  const porUsuario = new Map<string, { wins: number; losses: number; ganho: number }>();
  for (const bet of bets) {
    const agg = porUsuario.get(bet.user_id) ?? { wins: 0, losses: 0, ganho: 0 };
    if (bet.status === "won") {
      agg.wins++;
      agg.ganho += Number(bet.potential_payout ?? 0);
    } else {
      agg.losses++;
    }
    porUsuario.set(bet.user_id, agg);
  }

  let enviados = 0;
  for (const [userId, { wins, losses, ganho }] of porUsuario) {
    const total = wins + losses;
    const ganhoFmt = "Z$ " + ganho.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const body =
      wins > 0
        ? `Você acertou ${wins} de ${total} palpite${total !== 1 ? "s" : ""} e recebeu ${ganhoFmt}. Continue assim!`
        : `${total} palpite${total !== 1 ? "s" : ""} resolvido${total !== 1 ? "s" : ""} esta semana. Novos eventos te esperam!`;

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "market_resolved",
      title: "Seu resumo da semana 📊",
      body,
      data: { wins, losses, ganho },
    });
    sendPushToUser(supabase, userId, {
      title: "Seu resumo da semana 📊",
      body,
      url: "/perfil",
    }).catch(() => {});

    enviados++;
  }

  return NextResponse.json({ success: true, users: enviados });
}
