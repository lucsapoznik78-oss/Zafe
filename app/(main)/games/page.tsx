export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, Medal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEvents, getUserPredictions, getUserStats, STATUS_FILTERS } from "@/lib/games/queries";
import EventCard from "@/components/games/EventCard";
import GameFilterTabs from "@/components/games/GameFilterTabs";
import RankBadge from "@/components/games/RankBadge";
import PremiumStatsCard from "@/components/games/PremiumStatsCard";
import { getIsPremium } from "@/lib/games/premium";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Zafe Games — bolão de e-sports",
  description: "Palpite no vencedor das partidas de Free Fire, Valorant, CS2 e LoL. Pontos, ranks e potes em Z$.",
  alternates: { canonical: "/games" },
};

const VALID_GAMES = ["free_fire", "valorant", "cs2", "lol"];

interface PageProps {
  searchParams: Promise<{ status?: string; game?: string }>;
}

export default async function GamesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status && STATUS_FILTERS[params.status] ? params.status : "proximos";
  const game = VALID_GAMES.includes(params.game ?? "") ? params.game! : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [events, predictions, stats, isPremium] = await Promise.all([
    getEvents(supabase, { status, game }),
    user ? getUserPredictions(supabase, user.id) : Promise.resolve([]),
    user ? getUserStats(supabase, user.id) : Promise.resolve(null),
    user ? getIsPremium(supabase, user.id) : Promise.resolve(false),
  ]);

  const predByEvent = new Map(predictions.map((p) => [p.event_id, p]));

  return (
    <div className="py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Gamepad2 size={20} className="text-violet-400" /> Zafe Games
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Palpite em quem ganha cada partida de e-sports. Acertou, pontua e sobe de rank.
          </p>
        </div>
        {user && (
          <div className="text-right shrink-0 space-y-1">
            {stats && <RankBadge tier={stats.current_tier} size="md" />}
            <p className="text-[11px] text-muted-foreground">
              {stats ? `${stats.points_total} pts · ${stats.events_won} vitórias` : "Sem pontos ainda"} ·{" "}
              <Link href="/games/ranking" className="text-violet-300 hover:underline">
                ranking
              </Link>
            </p>
          </div>
        )}
      </div>

      {user && <PremiumStatsCard stats={stats} isPremium={isPremium} />}

      <div className="flex items-center gap-3 flex-wrap">
        <GameFilterTabs status={status} game={game} />
        <Link
          href="/games/ranking"
          className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-white border border-border hover:border-violet-400/40 transition-all flex items-center gap-1.5"
        >
          <Medal size={13} /> Ranking
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Gamepad2 size={40} className="mx-auto mb-3 text-violet-400/40" />
          <p className="text-white font-medium mb-1">Nenhum evento por aqui ainda</p>
          <p className="text-sm">Os confrontos aparecem conforme o calendário dos campeonatos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              prediction={predByEvent.get(e.id) ?? null}
              isAuthed={!!user}
            />
          ))}
        </div>
      )}

      <LegalFooter />
    </div>
  );
}
