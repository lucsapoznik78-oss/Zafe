export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCompetition, getLeaderboard } from "@/lib/copa/queries";
import Leaderboard from "@/components/copa/Leaderboard";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Ranking — Zafe Copa 2026",
  description: "Classificação geral do bolão da Copa do Mundo 2026 da Zafe.",
};

export default async function CopaRankingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const competition = await getCompetition(admin);
  if (!competition) redirect("/copa");

  const rows = await getLeaderboard(admin, competition.id);

  return (
    <div className="py-6 space-y-5">
      <div>
        <Link
          href="/copa"
          className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft size={12} /> Voltar à Zafe Copa
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy size={20} className="text-yellow-400" /> Ranking da Zafe Copa
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Desempate: pontos → placares exatos → acertos de vencedor → ordem de inscrição. O 1º colocado leva o
          pote de Z$ {Number(competition.pot_total).toLocaleString("pt-BR")}.
        </p>
      </div>

      <Leaderboard rows={rows} meUserId={user?.id ?? null} />

      <LegalFooter />
    </div>
  );
}
