export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Medal, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/games/queries";
import RankBadge from "@/components/games/RankBadge";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Ranking — Zafe Games",
  description: "Ranking de previsores de e-sports da Zafe Games.",
  alternates: { canonical: "/games/ranking" },
};

export default async function GamesRankingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const rows = await getLeaderboard(supabase, 100);

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Medal size={20} className="text-primary" /> Ranking Zafe Games
        </h1>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Ninguém pontuou ainda. Seja o primeiro a palpitar.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_5rem_3.5rem_3.5rem] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
            <span>#</span>
            <span>Previsor</span>
            <span>Rank</span>
            <span className="text-right">Pts</span>
            <span className="text-right">Vit.</span>
          </div>
          {rows.map((r) => {
            const isMe = user != null && r.user_id === user.id;
            return (
              <div
                key={r.user_id}
                className={`grid grid-cols-[2.5rem_1fr_5rem_3.5rem_3.5rem] gap-2 px-4 py-2.5 items-center border-b border-border last:border-b-0 text-sm ${
                  isMe ? "bg-primary/10" : ""
                }`}
              >
                <span className="font-mono text-muted-foreground flex items-center gap-1">
                  {r.posicao}
                  {r.posicao === 1 && <Trophy size={11} className="text-primary" />}
                </span>
                <span className={`truncate ${isMe ? "text-primary font-semibold" : "text-foreground"}`}>
                  {r.username}
                  {isMe && <span className="text-[10px] ml-1.5 text-primary/70">(você)</span>}
                </span>
                <span><RankBadge tier={r.current_tier} /></span>
                <span className="text-right font-bold text-foreground">{r.points_total}</span>
                <span className="text-right text-muted-foreground">{r.events_won}</span>
              </div>
            );
          })}
        </div>
      )}

      <LegalFooter />
    </div>
  );
}
