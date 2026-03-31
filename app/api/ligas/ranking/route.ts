import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ligaId = searchParams.get("liga_id");
  if (!ligaId) return NextResponse.json({ error: "liga_id obrigatório" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Verificar que o usuário é membro
  const { data: membership } = await supabase
    .from("liga_members")
    .select("id")
    .eq("liga_id", ligaId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Buscar membros ativos + seus bets nos tópicos da liga
  const { data: members } = await supabase
    .from("liga_members")
    .select("user_id, profiles(id, username, full_name)")
    .eq("liga_id", ligaId)
    .eq("status", "active");

  if (!members?.length) return NextResponse.json([]);

  const memberIds = members.map((m) => m.user_id);

  // Buscar todos os bets dos membros em tópicos desta liga
  const { data: bets } = await supabase
    .from("bets")
    .select("user_id, amount, payout, status, topic:topics!inner(liga_id)")
    .in("user_id", memberIds)
    .eq("topics.liga_id", ligaId);

  // Calcular estatísticas por membro
  const statsMap = new Map<string, { invested: number; payout: number; won: number; total: number }>();
  for (const b of bets ?? []) {
    const s = statsMap.get(b.user_id) ?? { invested: 0, payout: 0, won: 0, total: 0 };
    s.invested += b.amount;
    s.total += 1;
    if (b.status === "won") {
      s.payout += b.payout ?? 0;
      s.won += 1;
    }
    statsMap.set(b.user_id, s);
  }

  const ranking = members.map((m) => {
    const s = statsMap.get(m.user_id) ?? { invested: 0, payout: 0, won: 0, total: 0 };
    return {
      user_id: m.user_id,
      username: (m.profiles as any)?.username ?? "?",
      full_name: (m.profiles as any)?.full_name ?? "?",
      profit: s.payout - s.invested,
      invested: s.invested,
      won: s.won,
      total: s.total,
    };
  }).sort((a, b) => b.profit - a.profit);

  return NextResponse.json(ranking);
}
