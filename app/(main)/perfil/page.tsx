export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilTabs from "@/components/perfil/PerfilTabs";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: wallet }, { data: bets }, { data: referrals }, { count: betsWonTotal }, { data: gamesStats }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    supabase
      .from("bets")
      .select("*, topic:topics(id, title, category, status, resolution, is_private)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("referrals").select("status").eq("referrer_id", user.id),
    // Nível: total de acertos na plataforma (todos os módulos) + vitórias no Games
    supabase.from("bets").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "won"),
    supabase.from("games_user_stats").select("events_won").eq("user_id", user.id).maybeSingle(),
  ]);

  const totalWins = (betsWonTotal ?? 0) + (gamesStats?.events_won ?? 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

  return (
    <PerfilTabs
      profile={profile}
      wallet={wallet}
      bets={bets ?? []}
      referrals={referrals ?? []}
      appUrl={appUrl}
      totalWins={totalWins}
    />
  );
}
