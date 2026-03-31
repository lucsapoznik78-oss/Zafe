export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Swords, Clock, Users } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  recruiting: "Recrutando",
  leader_election: "Eleição de Líderes",
  judge_negotiation: "Negociação de Juízes",
  judge_confirmation: "Confirmação de Juízes",
  active: "Em Andamento",
  voting: "Votação",
  voting_round2: "Votação (2ª Rodada)",
  resolved: "Resolvida",
  cancelled: "Cancelada",
};

const PHASE_COLORS: Record<string, string> = {
  recruiting: "text-yellow-400 bg-yellow-400/10",
  leader_election: "text-blue-400 bg-blue-400/10",
  judge_negotiation: "text-purple-400 bg-purple-400/10",
  judge_confirmation: "text-indigo-400 bg-indigo-400/10",
  active: "text-sim bg-sim/10",
  voting: "text-primary bg-primary/10",
  voting_round2: "text-orange-400 bg-orange-400/10",
  resolved: "text-muted-foreground bg-muted/20",
  cancelled: "text-nao bg-nao/10",
};

export default async function ApostaPrivadasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Buscar apostas onde o usuário é participante
  const { data: participations } = await supabase
    .from("topic_participants")
    .select("topic_id, side, status")
    .eq("user_id", user.id);

  const topicIds = participations?.map((p) => p.topic_id) ?? [];

  // Buscar apostas onde o usuário é juiz (nominations)
  const { data: judgeNominations } = await supabase
    .from("judge_nominations")
    .select("topic_id")
    .eq("judge_user_id", user.id)
    .in("status", ["both_approved", "active"]);

  const judgeTopicIds = judgeNominations?.map((n) => n.topic_id) ?? [];

  const allTopicIds = [...new Set([...topicIds, ...judgeTopicIds])];

  let topics: any[] = [];
  if (allTopicIds.length > 0) {
    const { data } = await supabase
      .from("topics")
      .select("id, title, private_phase, recruitment_deadline, closes_at, creator_id, creator:profiles!creator_id(username)")
      .in("id", allTopicIds)
      .eq("is_private", true)
      .order("created_at", { ascending: false });
    topics = data ?? [];
  }

  // Contar participantes por tópico
  const participantCounts: Record<string, number> = {};
  if (allTopicIds.length > 0) {
    const { data: counts } = await supabase
      .from("topic_participants")
      .select("topic_id")
      .in("topic_id", allTopicIds)
      .eq("status", "accepted");
    counts?.forEach((c) => {
      participantCounts[c.topic_id] = (participantCounts[c.topic_id] ?? 0) + 1;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Apostas Privadas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Apostas em grupo com juízes e líderes eleitos</p>
        </div>
        <Link
          href="/apostas-privadas/criar"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black text-sm font-bold rounded-xl"
        >
          <Plus size={16} />
          Criar
        </Link>
      </div>

      {topics.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center space-y-4">
          <Swords size={40} className="text-muted-foreground mx-auto" />
          <div>
            <p className="text-white font-semibold">Nenhuma aposta privada ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Crie uma aposta e convide seus amigos para o desafio</p>
          </div>
          <Link
            href="/apostas-privadas/criar"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-black text-sm font-bold rounded-xl"
          >
            <Plus size={14} />
            Criar Aposta Privada
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => {
            const phase = topic.private_phase ?? "recruiting";
            const phaseLabel = PHASE_LABELS[phase] ?? phase;
            const phaseColor = PHASE_COLORS[phase] ?? "text-muted-foreground bg-muted/20";
            const myRole = judgeTopicIds.includes(topic.id)
              ? "Juiz"
              : participations?.find((p) => p.topic_id === topic.id)?.side === "A"
              ? "Lado A (SIM)"
              : "Lado B (NÃO)";

            return (
              <Link
                key={topic.id}
                href={`/apostas-privadas/${topic.id}`}
                className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white line-clamp-2">{topic.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">por @{topic.creator?.username}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${phaseColor}`}>
                    {phaseLabel}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {participantCounts[topic.id] ?? 0} participantes
                  </span>
                  {topic.closes_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(topic.closes_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span className="text-primary font-medium">{myRole}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
