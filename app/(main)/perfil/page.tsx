export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilTabs from "@/components/perfil/PerfilTabs";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: wallet }, { data: bets }, { data: referrals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    supabase
      .from("bets")
      .select("*, topic:topics(id, title, category, status, resolution, is_private)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("referrals").select("status").eq("referrer_id", user.id),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe.app";

  return (
    <PerfilTabs
      profile={profile}
      wallet={wallet}
      bets={bets ?? []}
      referrals={referrals ?? []}
      appUrl={appUrl}
    />
  );
}
