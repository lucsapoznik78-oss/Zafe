import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

// Cron diário: compara a posição de cada previsor no ranking geral com o
// snapshot anterior (ranking_positions) e notifica quem SUBIU. Mesma lógica
// de cálculo da página /ranking (período "todos", lucro > volume).

const MIN_BETS = 1;

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: bets } = await admin
    .from("bets")
    .select("user_id, amount, potential_payout, status")
    .in("status", ["won", "lost", "matched", "pending"]);

  const statsMap = new Map<string, { count: number; lucro: number; volume: number }>();
  for (const bet of bets ?? []) {
    const s = statsMap.get(bet.user_id) ?? { count: 0, lucro: 0, volume: 0 };
    s.count++;
    s.volume += bet.amount;
    if (bet.status === "won") s.lucro += (bet.potential_payout ?? 0) - bet.amount;
    else if (bet.status === "lost") s.lucro -= bet.amount;
    statsMap.set(bet.user_id, s);
  }

  const ranked = Array.from(statsMap.entries())
    .filter(([, s]) => s.count >= MIN_BETS)
    .sort((a, b) => b[1].lucro - a[1].lucro || b[1].volume - a[1].volume)
    .map(([id]) => id);

  if (ranked.length === 0) {
    return NextResponse.json({ success: true, notified: 0, ranked: 0 });
  }

  const { data: previous } = await admin
    .from("ranking_positions")
    .select("user_id, position");
  const prevMap = new Map((previous ?? []).map((r) => [r.user_id, r.position]));

  // Notifica quem subiu (só quem já estava no snapshot anterior)
  const notifications: { user_id: string; type: string; title: string; body: string; data: object }[] = [];
  ranked.forEach((userId, idx) => {
    const newPos = idx + 1;
    const oldPos = prevMap.get(userId);
    if (oldPos !== undefined && newPos < oldPos) {
      const delta = oldPos - newPos;
      notifications.push({
        user_id: userId,
        type: "ranking_up",
        title: "Você subiu no ranking! 📈",
        body: `Você subiu ${delta} posiç${delta > 1 ? "ões" : "ão"} e agora é o ${newPos}º previsor do Brasil.`,
        data: { position: newPos, delta },
      });
    }
  });

  for (let i = 0; i < notifications.length; i += 500) {
    await admin.from("notifications").insert(notifications.slice(i, i + 500));
  }

  // Atualiza o snapshot
  const rows = ranked.map((userId, idx) => ({
    user_id: userId,
    position: idx + 1,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("ranking_positions").upsert(rows.slice(i, i + 500), { onConflict: "user_id" });
  }

  return NextResponse.json({ success: true, notified: notifications.length, ranked: ranked.length });
}
