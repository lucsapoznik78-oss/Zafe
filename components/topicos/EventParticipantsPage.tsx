import Link from "next/link";
import { ArrowLeft, CalendarDays, ListFilter, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import CategoryBadge from "@/components/topicos/CategoryBadge";
import { createAdminClient } from "@/lib/supabase/server";

type Pillar = "liga" | "economico" | "concurso" | "privadas";
type BetSide = "sim" | "nao";

interface EventParticipantsPageProps {
  id: string;
  pillar: Pillar;
  privateAccessUserId?: string;
}

interface BetRow {
  id: string;
  user_id: string;
  side: BetSide;
  amount: number;
  status: string;
  locked_odds?: number | string | null;
  potential_payout?: number | string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "pendente",
  matched: "ativo",
  partial: "ativo",
  won: "ganhou",
  lost: "perdeu",
  refunded: "reembolso",
  exited: "saiu",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-400/15 text-yellow-300",
  matched: "bg-primary/15 text-primary",
  partial: "bg-primary/15 text-primary",
  won: "bg-sim/15 text-sim",
  lost: "bg-nao/15 text-nao",
  refunded: "bg-zinc-500/15 text-zinc-300",
  exited: "bg-zinc-500/15 text-zinc-300",
};

function formatZ(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function initials(profile?: ProfileRow | null) {
  const name = profile?.username ?? profile?.full_name ?? "?";
  return name.slice(0, 2).toUpperCase();
}

function entryPercent(bet: BetRow) {
  const lockedOdds = Number(bet.locked_odds);
  if (Number.isFinite(lockedOdds) && lockedOdds > 0) return 100 / lockedOdds;

  const amount = Number(bet.amount);
  const payout = Number(bet.potential_payout);
  if (Number.isFinite(amount) && amount > 0 && Number.isFinite(payout) && payout > 0) {
    return (amount / payout) * 100;
  }

  return null;
}

function eventHref(pillar: Pillar, topic: any) {
  if (pillar === "privadas") return `/privadas/${topic.id}`;
  const key = topic.slug ?? topic.id;
  if (pillar === "economico") return `/economico/${key}`;
  if (pillar === "concurso") return `/concurso/${key}`;
  return `/liga/${key}`;
}

function participantsHref(pillar: Pillar, topic: any) {
  return `${eventHref(pillar, topic)}/participantes`;
}

export async function EventParticipantsPage({
  id,
  pillar,
  privateAccessUserId,
}: EventParticipantsPageProps) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Para concurso, precisamos do concurso_id ativo
  let concursoId: string | null = null;
  if (pillar === "concurso") {
    const { data: concurso } = await admin
      .from("concursos")
      .select("id")
      .eq("status", "ativo")
      .lte("periodo_inicio", now)
      .gte("periodo_fim", now)
      .single();
    concursoId = concurso?.id ?? null;
  }

  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const topicQuery = admin
    .from("topics")
    .select("id, slug, title, description, category, status, closes_at, is_private, creator_id");

  // Concurso filtra por concurso_id
  if (pillar === "concurso" && concursoId) {
    topicQuery.eq("concurso_id", concursoId);
  }

  const { data: topic } = isUUID
    ? await topicQuery.eq("id", id).single()
    : await topicQuery.eq("slug", id).single();

  if (!topic) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Evento não encontrado.</p>
      </div>
    );
  }

  if (pillar === "privadas") {
    if (!privateAccessUserId) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Entre para ver os participantes deste bolão.</p>
        </div>
      );
    }

    const [{ data: participant }, { data: judge }] = await Promise.all([
      admin
        .from("topic_participants")
        .select("id")
        .eq("topic_id", topic.id)
        .eq("user_id", privateAccessUserId)
        .limit(1)
        .maybeSingle(),
      admin
        .from("judge_nominations")
        .select("id")
        .eq("topic_id", topic.id)
        .eq("judge_user_id", privateAccessUserId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!participant && !judge) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Você não tem acesso aos participantes deste bolão.</p>
        </div>
      );
    }
  }

  const isConcurso = pillar === "concurso";
  const betTable = isConcurso ? "concurso_bets" : "bets";
  const selectFields = isConcurso
    ? "id, user_id, side, amount, status, potential_payout, created_at"
    : "id, user_id, side, amount, status, locked_odds, potential_payout, created_at";

  let betQuery = (admin as any)
    .from(betTable)
    .select(selectFields)
    .eq("topic_id", topic.id)
    .in("status", ["pending", "matched", "partial", "won", "lost", "refunded", "exited"]);

  if (isConcurso && concursoId) {
    betQuery = betQuery.eq("concurso_id", concursoId);
  }

  const { data: rawBets } = await betQuery.order("created_at", { ascending: true });

  const bets = (rawBets ?? []) as BetRow[];
  const userIds = [...new Set(bets.map((bet) => bet.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, username, full_name, avatar_url").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile: ProfileRow) => [profile.id, profile]));

  const grouped = userIds
    .map((userId) => {
      const userBets = bets.filter((bet) => bet.user_id === userId);
      const total = userBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
      const simTotal = userBets
        .filter((bet) => bet.side === "sim")
        .reduce((sum, bet) => sum + Number(bet.amount), 0);
      const naoTotal = userBets
        .filter((bet) => bet.side === "nao")
        .reduce((sum, bet) => sum + Number(bet.amount), 0);
      const weightedEntry = userBets.reduce((sum, bet) => {
        const pct = entryPercent(bet);
        return pct == null ? sum : sum + pct * Number(bet.amount);
      }, 0);
      const entryBase = userBets.reduce((sum, bet) => (
        entryPercent(bet) == null ? sum : sum + Number(bet.amount)
      ), 0);

      return {
        userId,
        profile: profileMap.get(userId) ?? null,
        bets: userBets,
        total,
        simTotal,
        naoTotal,
        avgEntryPercent: entryBase > 0 ? weightedEntry / entryBase : null,
        firstEntry: userBets[0]?.created_at ?? null,
        lastEntry: userBets[userBets.length - 1]?.created_at ?? null,
      };
    })
    .sort((a, b) => b.total - a.total);

  const totalSim = bets
    .filter((bet) => bet.side === "sim")
    .reduce((sum, bet) => sum + Number(bet.amount), 0);
  const totalNao = bets
    .filter((bet) => bet.side === "nao")
    .reduce((sum, bet) => sum + Number(bet.amount), 0);
  const totalVolume = totalSim + totalNao;
  const hrefBack = eventHref(pillar, topic);

  return (
    <div className="py-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Link href={hrefBack} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft size={14} />
          Voltar ao evento
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={topic.category} />
          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold">
            {pillar === "economico" ? "Zafe Econômico" : pillar === "concurso" ? "Concurso" : pillar === "privadas" ? "Privadas" : "Zafe Liga"}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-snug">Participantes</h1>
          <p className="text-sm text-muted-foreground mt-1">{topic.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Usuários</p>
          <p className="text-xl font-bold text-white">{grouped.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Entradas</p>
          <p className="text-xl font-bold text-white">{bets.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">SIM</p>
          <p className={`text-xl font-bold ${isConcurso ? "text-yellow-400" : "text-sim"}`}>{isConcurso ? "ZC$" : "Z$"} {formatZ(totalSim)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">NÃO</p>
          <p className={`text-xl font-bold ${isConcurso ? "text-yellow-400" : "text-nao"}`}>{isConcurso ? "ZC$" : "Z$"} {formatZ(totalNao)}</p>
        </div>
      </div>

      {totalVolume > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex h-2">
            <div className="bg-sim" style={{ width: `${(totalSim / totalVolume) * 100}%` }} />
            <div className="bg-nao flex-1" />
          </div>
          <div className="px-4 py-3 flex justify-between text-xs text-muted-foreground">
            <span>SIM {(totalSim / totalVolume * 100).toFixed(1)}%</span>
            <span>Total {isConcurso ? "ZC$" : "Z$"} {formatZ(totalVolume)}</span>
            <span>NÃO {(totalNao / totalVolume * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Users size={22} className="mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum participante ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((participant, index) => {
            const profile = participant.profile;
            const displayName = profile?.username ? `@${profile.username}` : profile?.full_name ?? "anônimo";
            const profileHref = profile?.username ? `/u/${profile.username}` : null;

            return (
              <section key={participant.userId} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-start gap-3">
                  <span className="text-[10px] text-zinc-600 w-5 text-center font-mono pt-2">{index + 1}</span>
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(profile)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {profileHref ? (
                        <Link href={profileHref} className="text-sm font-semibold text-white hover:text-primary transition-colors">
                          {displayName}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-white">{displayName}</span>
                      )}
                      {participant.avgEntryPercent != null && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                          entrada média {participant.avgEntryPercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {isConcurso ? "ZC$" : "Z$"} {formatZ(participant.total)} alocados
                      </span>
                      <span>{participant.bets.length} entrada{participant.bets.length !== 1 ? "s" : ""}</span>
                      {participant.firstEntry && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} />
                          desde {format(new Date(participant.firstEntry), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${isConcurso ? "text-yellow-400" : "text-sim"}`}>SIM {isConcurso ? "ZC$" : "Z$"} {formatZ(participant.simTotal)}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${isConcurso ? "text-yellow-400" : "text-nao"}`}>NÃO {isConcurso ? "ZC$" : "Z$"} {formatZ(participant.naoTotal)}</p>
                  </div>
                </div>

                <div className="divide-y divide-border/30">
                  {participant.bets.map((bet) => {
                    const isSim = bet.side === "sim";
                    const pct = entryPercent(bet);

                    return (
                      <div key={bet.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-4 md:items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isSim ? "bg-sim/15 text-sim" : "bg-nao/15 text-nao"}`}>
                            {bet.side.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_CLASS[bet.status] ?? "bg-zinc-500/15 text-zinc-300"}`}>
                            {STATUS_LABEL[bet.status] ?? bet.status}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {isConcurso ? "ZC$" : "Z$"} {formatZ(Number(bet.amount))}
                        </div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <ListFilter size={12} />
                          {pct == null ? "entrada sem registro de %" : `entrou em ${pct.toFixed(1)}%`}
                        </div>
                        <div className="text-xs text-muted-foreground md:text-right">
                          {formatDateTime(bet.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <Link href={participantsHref(pillar, topic)} className="text-[11px] text-muted-foreground hover:text-white transition-colors">
          Link desta página
        </Link>
      </div>
    </div>
  );
}
