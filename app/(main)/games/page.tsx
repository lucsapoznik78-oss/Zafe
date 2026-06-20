export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, Medal, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEvents, getUserPredictions, getUserStats, STATUS_FILTERS } from "@/lib/games/queries";
import EventCard from "@/components/games/EventCard";
import GameFilterTabs from "@/components/games/GameFilterTabs";
import RankBadge from "@/components/games/RankBadge";
import StatsPanel from "@/components/games/StatsPanel";
import RankProgress from "@/components/games/RankProgress";
import { GAME_KINDS } from "@/lib/games/types";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Zafe Games — bolão de e-sports",
  description: "Palpite no vencedor das partidas de Free Fire, Valorant, CS2, LoL, EA FC, Fortnite e mais. Pontos, ranks e potes em Z$.",
  alternates: { canonical: "/games" },
};

const VALID_GAMES: string[] = GAME_KINDS;

interface PageProps {
  searchParams: Promise<{ status?: string; game?: string }>;
}

export default async function GamesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status && STATUS_FILTERS[params.status] ? params.status : "proximos";
  const game = VALID_GAMES.includes(params.game ?? "") ? params.game! : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [events, predictions, stats] = await Promise.all([
    getEvents(supabase, { status, game }),
    user ? getUserPredictions(supabase, user.id) : Promise.resolve([]),
    user ? getUserStats(supabase, user.id) : Promise.resolve(null),
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

      {user && stats && (
        <RankProgress tier={stats.current_tier} wins={stats.events_won} />
      )}

      {user && <StatsPanel stats={stats} />}

      <div className="flex items-center gap-3 flex-wrap">
        <GameFilterTabs status={status} game={game} />
        <div className="flex items-center gap-2 ml-auto">
          {user && (
            <Link
              href="/games/criar"
              className="px-3 py-1.5 rounded-md text-sm text-violet-200 border border-violet-400/40 bg-violet-500/10 hover:bg-violet-500/20 transition-all flex items-center gap-1.5"
            >
              <Plus size={13} /> Criar evento
            </Link>
          )}
          <Link
            href="/games/ranking"
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-white border border-border hover:border-violet-400/40 transition-all flex items-center gap-1.5"
          >
            <Medal size={13} /> Ranking
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Gamepad2 size={40} className="mx-auto mb-3 text-violet-400/40" />
          <p className="text-white font-medium mb-1">Nenhum evento por aqui ainda</p>
          <p className="text-sm">Os confrontos aparecem conforme o calendário — ou crie o seu e seja o juiz.</p>
          {user && (
            <Link
              href="/games/criar"
              className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md text-sm text-violet-200 border border-violet-400/40 bg-violet-500/10 hover:bg-violet-500/20 transition-all"
            >
              <Plus size={13} /> Criar evento
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              prediction={predByEvent.get(e.id) ?? null}
              isAuthed={!!user}
              currentUserId={user?.id ?? null}
            />
          ))}
        </div>
      )}

      <LegalFooter />
    </div>
  );
}
