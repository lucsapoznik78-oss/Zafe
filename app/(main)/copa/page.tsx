export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Medal, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getCompetition,
  getLeaderboard,
  getMatches,
  getParticipant,
  getParticipantCount,
  getUserGroupPicks,
  getUserPredictions,
} from "@/lib/copa/queries";
import { groupLockAt, groupTeams } from "@/lib/copa/group-picks";
import type { CopaMatch } from "@/lib/copa/types";
import PotBanner from "@/components/copa/PotBanner";
import JoinCard from "@/components/copa/JoinCard";
import StageTabs from "@/components/copa/StageTabs";
import MatchCard from "@/components/copa/MatchCard";
import GroupPicksBoard from "@/components/copa/GroupPicksBoard";
import LegalFooter from "@/components/layout/LegalFooter";

export const metadata: Metadata = {
  title: "Zafe Copa 2026",
  description: "O bolão da Copa do Mundo 2026 da Zafe: palpites, ranking e premiação em Z$.",
  alternates: { canonical: "/copa" },
};

interface PageProps {
  searchParams: Promise<{ stage?: string }>;
}

const VALID_STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"];

function groupByDay(matches: CopaMatch[]): Array<[string, CopaMatch[]]> {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const map = new Map<string, CopaMatch[]>();
  for (const m of matches) {
    const key = fmt.format(new Date(m.kickoff_at));
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }
  return Array.from(map.entries());
}

export default async function CopaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const stage = VALID_STAGES.includes(params.stage ?? "") ? params.stage! : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const competition = await getCompetition(supabase);
  if (!competition) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Trophy size={40} className="mx-auto mb-3 text-sky-400/40" />
        <p className="text-white font-semibold mb-1">Zafe Copa ainda não está no ar</p>
        <p className="text-sm">A competição será aberta em breve.</p>
      </div>
    );
  }

  const [participant, participants, matches, predictions, leaderboard, groupPicks] = await Promise.all([
    getParticipant(supabase, competition.id, user.id),
    getParticipantCount(supabase, competition.id),
    getMatches(supabase, competition.id, stage ? { stage } : undefined),
    getUserPredictions(supabase, competition.id, user.id),
    getLeaderboard(supabase, competition.id),
    getUserGroupPicks(supabase, competition.id, user.id),
  ]);

  const predByMatch = new Map(predictions.map((p) => [p.match_id, p]));
  const myRow = leaderboard.find((r) => r.user_id === user.id) ?? null;
  const canJoin = !participant && ["open", "running"].includes(competition.status);
  const days = groupByDay(matches);

  // Cartela de classificação por grupo (só na aba Grupos)
  const groupsMap = new Map<string, CopaMatch[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_name) continue;
    if (!groupsMap.has(m.group_name)) groupsMap.set(m.group_name, []);
    groupsMap.get(m.group_name)!.push(m);
  }
  const groups = Array.from(groupsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, ms]) => ({
      name,
      teams: groupTeams(ms),
      lockAt: groupLockAt(ms)!,
    }))
    .filter((g) => g.teams.length >= 4);
  const picksByGroup = Object.fromEntries(
    groupPicks.map((p) => [p.group_name, p])
  );

  return (
    <div className="py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy size={20} className="text-sky-400" /> {competition.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Acerte o vencedor (+10) e o placar exato (+10) de cada partida. Quem somar mais pontos leva o pote.
          </p>
        </div>
        {participant ? (
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/30 text-[10px] font-bold text-sky-400">
              <CheckCircle2 size={11} /> Inscrito
            </span>
            <p className="text-2xl font-bold text-sky-400 mt-1">{myRow?.points ?? 0} pts</p>
            <p className="text-[11px] text-muted-foreground">
              {myRow ? `${myRow.posicao}º lugar` : "Sem pontuação ainda"} ·{" "}
              <Link href="/copa/ranking" className="text-sky-400 hover:underline">
                ver ranking
              </Link>
            </p>
          </div>
        ) : (
          canJoin && <JoinCard buyIn={Number(competition.buy_in)} />
        )}
      </div>

      <PotBanner competition={competition} participants={participants} />

      {/* Atalho do ranking */}
      <div className="flex items-center gap-3 flex-wrap">
        <StageTabs current={stage} />
        <Link
          href="/copa/ranking"
          className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-white border border-border hover:border-sky-400/40 transition-all flex items-center gap-1.5"
        >
          <Medal size={13} /> Ranking
        </Link>
      </div>

      {/* Cartela: quem passa em cada grupo */}
      {stage === "group" && groups.length > 0 && (
        <GroupPicksBoard
          groups={groups}
          initialPicks={picksByGroup}
          isParticipant={!!participant}
        />
      )}

      {/* Fixture por dia */}
      {days.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-white font-medium mb-1">Nenhuma partida nesta fase ainda</p>
          <p className="text-sm">A tabela é carregada conforme o sorteio e o avanço do mata-mata.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(([day, dayMatches]) => (
            <section key={day} className="space-y-3">
              <h2 className="text-sm font-semibold text-white">{day}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {dayMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predByMatch.get(m.id) ?? null}
                    isParticipant={!!participant}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <LegalFooter />
    </div>
  );
}
