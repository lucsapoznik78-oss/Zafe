"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Users, Shield, Vote, CheckCircle } from "lucide-react";

const PHASE_LABELS: Record<string, { label: string; step: number }> = {
  recruiting:         { label: "Recrutando participantes", step: 1 },
  leader_election:    { label: "Eleição de líderes",        step: 2 },
  judge_negotiation:  { label: "Negociação de juízes",      step: 3 },
  judge_confirmation: { label: "Confirmação de juízes",     step: 4 },
  active:             { label: "Aposta ativa",               step: 5 },
  voting:             { label: "Votação dos juízes",         step: 6 },
  voting_round2:      { label: "2ª Votação",                 step: 6 },
  resolved:           { label: "Resolvida",                  step: 7 },
  cancelled:          { label: "Cancelada",                  step: 7 },
};

interface Props {
  topic: any;
  sides: any[];
  participants: any[];
  nominations: any[];
  leaderVotes: any[];
  judgeVotes: any[];
  currentUserId: string;
  myParticipant: any;
  isJudge: boolean;
}

export default function PrivateBetRoom({
  topic, sides, participants, nominations, leaderVotes, judgeVotes,
  currentUserId, myParticipant, isJudge,
}: Props) {
  const router = useRouter();
  const phase = topic.private_phase ?? "recruiting";
  const phaseInfo = PHASE_LABELS[phase] ?? { label: phase, step: 0 };

  const sideA = sides.find(s => s.side === "A");
  const sideB = sides.find(s => s.side === "B");
  const mySide = myParticipant?.side;
  const isLeader = sideA?.leader_id === currentUserId || sideB?.leader_id === currentUserId;
  const myLeaderSide = sideA?.leader_id === currentUserId ? "A" : sideB?.leader_id === currentUserId ? "B" : null;

  const participantsA = participants.filter(p => p.side === "A" && p.status === "accepted");
  const participantsB = participants.filter(p => p.side === "B" && p.status === "accepted");
  const activeJudges = nominations.filter(n => n.status === "active");
  const proposedJudges = nominations.filter(n => ["proposed", "both_approved"].includes(n.status));

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded">PRIVADA</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded ${
            phase === "cancelled" ? "bg-red-400/20 text-red-400" :
            phase === "resolved"  ? "bg-muted text-muted-foreground" :
            "bg-yellow-400/20 text-yellow-400"
          }`}>{phaseInfo.label}</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{topic.title}</h1>
        {topic.description && <p className="text-muted-foreground text-sm mt-1">{topic.description}</p>}
      </div>

      {/* Progresso das fases */}
      <PhaseProgress currentStep={phaseInfo.step} />

      {/* Participantes por lado */}
      <div className="grid grid-cols-2 gap-4">
        <SidePanel
          side="A" label="SIM" color="sim"
          leader={sideA?.leader}
          participants={participantsA}
          isMySide={mySide === "A"}
          topicId={topic.id}
          phase={phase}
          onRefresh={() => router.refresh()}
        />
        <SidePanel
          side="B" label="NÃO" color="nao"
          leader={sideB?.leader}
          participants={participantsB}
          isMySide={mySide === "B"}
          topicId={topic.id}
          phase={phase}
          onRefresh={() => router.refresh()}
        />
      </div>

      {/* Fase: recrutamento */}
      {phase === "recruiting" && myParticipant?.status === "invited" && (
        <AcceitarConvite topicId={topic.id} minBet={topic.min_bet} onRefresh={() => router.refresh()} />
      )}

      {/* Fase: eleição de líder */}
      {phase === "leader_election" && mySide && (
        <LeaderElectionPanel
          topicId={topic.id}
          side={mySide}
          participants={mySide === "A" ? participantsA : participantsB}
          currentUserId={currentUserId}
          myVote={leaderVotes.find(v => v.candidate_id)}
          currentLeader={mySide === "A" ? sideA?.leader_id : sideB?.leader_id}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Fase: juízes */}
      {["judge_negotiation", "judge_confirmation"].includes(phase) && (
        <JudgeNegotiationPanel
          topicId={topic.id}
          nominations={nominations}
          currentUserId={currentUserId}
          isLeader={isLeader}
          myLeaderSide={myLeaderSide}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Fase: votação dos juízes */}
      {["voting", "voting_round2"].includes(phase) && isJudge && (
        <JudgeVotingPanel
          topicId={topic.id}
          round={phase === "voting" ? 1 : 2}
          deadline={topic.judge_vote_deadline}
          myVote={judgeVotes.find(v => v.judge_id === currentUserId)}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Resultado dos votos (visível para todos) */}
      {["voting", "voting_round2"].includes(phase) && (
        <VoteProgress votes={judgeVotes} totalJudges={activeJudges.length} />
      )}

      {/* Resolvido */}
      {phase === "resolved" && (
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <p className="text-lg font-bold text-white mb-1">Aposta Resolvida</p>
          <p className="text-muted-foreground text-sm">Resultado: {topic.resolution?.toUpperCase() ?? "—"}</p>
        </div>
      )}

      {phase === "cancelled" && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-5 text-center">
          <p className="text-lg font-bold text-red-400">Aposta Cancelada</p>
          <p className="text-muted-foreground text-sm mt-1">Os valores apostados foram reembolsados.</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function PhaseProgress({ currentStep }: { currentStep: number }) {
  const steps = [
    { n: 1, label: "Recrutar" },
    { n: 2, label: "Líder" },
    { n: 3, label: "Juízes" },
    { n: 4, label: "Confirmar" },
    { n: 5, label: "Ativa" },
    { n: 6, label: "Votar" },
    { n: 7, label: "Fim" },
  ];
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1 flex-1">
          <div className={`flex flex-col items-center flex-1`}>
            <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
              s.n < currentStep ? "bg-primary text-black" :
              s.n === currentStep ? "bg-primary/30 text-primary border border-primary" :
              "bg-border text-muted-foreground"
            }`}>{s.n < currentStep ? "✓" : s.n}</div>
            <span className="text-[9px] text-muted-foreground mt-0.5 hidden sm:block">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mb-3 rounded ${s.n < currentStep ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SidePanel({ side, label, color, leader, participants, isMySide, topicId, phase, onRefresh }: any) {
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviting, setInviting] = useState(false);

  async function convidar() {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    // Buscar usuário
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", inviteUsername.trim()).single();
    if (!profile) { alert("Usuário não encontrado"); setInviting(false); return; }

    await fetch(`/api/apostas-privadas/${topicId}/convidar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: profile.id }),
    });
    setInviteUsername("");
    setInviting(false);
    onRefresh();
  }

  const borderColor = color === "sim" ? "border-sim/30" : "border-nao/30";
  const labelColor = color === "sim" ? "text-sim" : "text-nao";

  return (
    <div className={`bg-card border rounded-xl p-4 space-y-2 ${borderColor}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${labelColor}`}>Lado {side} — {label}</span>
        <span className="text-xs text-muted-foreground">{participants.length} jogadores</span>
      </div>
      {leader && (
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-primary" />
          <span className="text-xs text-primary">Líder: @{leader.username}</span>
        </div>
      )}
      <div className="space-y-1">
        {participants.slice(0, 5).map((p: any) => (
          <p key={p.user_id} className="text-xs text-white">@{p.profile?.username}</p>
        ))}
        {participants.length > 5 && (
          <p className="text-xs text-muted-foreground">+{participants.length - 5} mais</p>
        )}
      </div>
      {isMySide && phase === "recruiting" && (
        <div className="flex gap-1 pt-1">
          <input
            className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-white"
            placeholder="Convidar username"
            value={inviteUsername}
            onChange={e => setInviteUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && convidar()}
          />
          <button onClick={convidar} disabled={inviting}
            className="px-2 py-1 bg-primary text-black text-xs font-bold rounded">
            +
          </button>
        </div>
      )}
    </div>
  );
}

function AcceitarConvite({ topicId, minBet, onRefresh }: any) {
  const [loading, setLoading] = useState(false);

  async function aceitar() {
    setLoading(true);
    await fetch(`/api/apostas-privadas/${topicId}/aceitar`, { method: "POST" });
    setLoading(false);
    onRefresh();
  }

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center space-y-3">
      <p className="text-white font-semibold">Você foi convidado para esta aposta!</p>
      <p className="text-muted-foreground text-sm">
        Ao aceitar, R$ {minBet?.toFixed(2)} serão debitados da sua carteira como aposta mínima.
      </p>
      <button onClick={aceitar} disabled={loading}
        className="px-6 py-2 bg-primary text-black font-bold rounded-lg disabled:opacity-50">
        {loading ? "Aceitando..." : "Aceitar e Apostar"}
      </button>
    </div>
  );
}

function LeaderElectionPanel({ topicId, side, participants, currentUserId, myVote, currentLeader, onRefresh }: any) {
  const [voted, setVoted] = useState<string | null>(myVote?.candidate_id ?? null);
  const [loading, setLoading] = useState(false);

  async function votar(candidateId: string) {
    setLoading(true);
    await fetch(`/api/apostas-privadas/${topicId}/votar-lider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId }),
    });
    setVoted(candidateId);
    setLoading(false);
    onRefresh();
  }

  if (currentLeader) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Vote size={16} className="text-primary" />
        <p className="text-sm font-semibold text-white">Eleja o líder do seu lado</p>
      </div>
      <p className="text-xs text-muted-foreground">O líder vai negociar os juízes em nome do grupo.</p>
      <div className="space-y-2">
        {participants.map((p: any) => (
          <button
            key={p.user_id}
            onClick={() => votar(p.user_id)}
            disabled={loading || !!voted}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
              voted === p.user_id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-white hover:border-primary/40"
            }`}
          >
            <span>@{p.profile?.username}</span>
            {p.user_id === currentUserId && <span className="text-xs text-muted-foreground">você</span>}
            {voted === p.user_id && <CheckCircle size={14} className="text-primary" />}
          </button>
        ))}
      </div>
      {voted && <p className="text-xs text-primary">Voto registrado. Aguardando os outros votarem.</p>}
    </div>
  );
}

function JudgeNegotiationPanel({ topicId, nominations, currentUserId, isLeader, myLeaderSide, onRefresh }: any) {
  const [newJudgeUsername, setNewJudgeUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function responder(nominationId: string, aceitar: boolean, substitutoId?: string) {
    setLoading(true);
    await fetch(`/api/apostas-privadas/${topicId}/juizes/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomination_id: nominationId, aceitar, substituto_id: substitutoId }),
    });
    setLoading(false);
    onRefresh();
  }

  async function confirmarDisponibilidade(nominationId: string, disponivel: boolean) {
    setLoading(true);
    await fetch(`/api/apostas-privadas/${topicId}/juizes/disponibilidade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomination_id: nominationId, disponivel }),
    });
    setLoading(false);
    onRefresh();
  }

  const activeNoms = nominations.filter((n: any) => n.status === "active");
  const pendingNoms = nominations.filter((n: any) => ["proposed", "both_approved"].includes(n.status));
  const myPendingConfirm = nominations.filter(
    (n: any) => n.judge_user_id === currentUserId && n.status === "both_approved"
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-primary" />
        <p className="text-sm font-semibold text-white">Juízes ({activeNoms.length} confirmados)</p>
      </div>

      {/* Juízes ativos */}
      {activeNoms.length > 0 && (
        <div className="space-y-1">
          {activeNoms.map((n: any) => (
            <div key={n.id} className="flex items-center gap-2 text-sm">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-white">@{n.judge?.username}</span>
            </div>
          ))}
        </div>
      )}

      {/* Eu sou juiz aguardando confirmação */}
      {myPendingConfirm.map((n: any) => (
        <div key={n.id} className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
          <p className="text-sm text-white font-semibold">Você foi escolhido como juiz!</p>
          <p className="text-xs text-muted-foreground">Aceita ser juiz desta aposta?</p>
          <div className="bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-white/70">Aviso:</span>{" "}
            Ao aceitar, você assume a responsabilidade de votar com imparcialidade.
            A Zafe não se responsabiliza por erros ou omissões do juiz — este foi indicado e aprovado
            pelos próprios participantes, sendo a escolha de responsabilidade exclusiva deles.
          </div>
          <div className="flex gap-2">
            <button onClick={() => confirmarDisponibilidade(n.id, true)} disabled={loading}
              className="flex-1 py-1.5 bg-green-400/20 text-green-400 text-sm font-semibold rounded-lg">
              Aceitar
            </button>
            <button onClick={() => confirmarDisponibilidade(n.id, false)} disabled={loading}
              className="flex-1 py-1.5 bg-red-400/20 text-red-400 text-sm font-semibold rounded-lg">
              Recusar
            </button>
          </div>
        </div>
      ))}

      {/* Nomeações pendentes — líder avalia */}
      {isLeader && pendingNoms.map((n: any) => {
        const mySideApproved = myLeaderSide === "A" ? n.leader_a_approved : n.leader_b_approved;
        const needsMyResponse = mySideApproved === null;

        return (
          <div key={n.id} className="border border-border/60 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">@{n.judge?.username}</span>
              <span className="text-xs text-muted-foreground">
                {n.status === "both_approved" ? "Aguardando juiz confirmar" : "Aguardando resposta"}
              </span>
            </div>
            {needsMyResponse && (
              <div className="flex gap-2">
                <button onClick={() => responder(n.id, true)} disabled={loading}
                  className="flex-1 py-1 bg-green-400/20 text-green-400 text-xs font-semibold rounded">
                  Aceitar
                </button>
                <button onClick={() => responder(n.id, false)} disabled={loading}
                  className="flex-1 py-1 bg-red-400/20 text-red-400 text-xs font-semibold rounded">
                  Rejeitar
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Aviso de responsabilidade sobre juízes */}
      <div className="bg-muted/40 border border-border/60 rounded-lg px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-white/70">Aviso:</span>{" "}
        O juiz é indicado e aprovado pelos líderes de ambos os lados. A Zafe não se responsabiliza por
        decisões incorretas ou desonestas do juiz — a escolha é de responsabilidade exclusiva dos participantes.
        Um único juiz aceito por ambos os lados é suficiente para a aposta avançar.
      </div>

      {/* Propor novo juiz (líder) */}
      {isLeader && activeNoms.length < 7 && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <input
            className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm text-white"
            placeholder="Username do novo juiz"
            value={newJudgeUsername}
            onChange={e => setNewJudgeUsername(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!newJudgeUsername.trim()) return;
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              const { data: p } = await supabase.from("profiles").select("id").eq("username", newJudgeUsername.trim()).single();
              if (!p) return;
              setLoading(true);
              await fetch(`/api/apostas-privadas/${topicId}/juizes/propor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ judge_user_id: p.id }),
              });
              setNewJudgeUsername("");
              setLoading(false);
              onRefresh();
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-primary text-black text-sm font-bold rounded"
          >
            Propor
          </button>
        </div>
      )}
    </div>
  );
}

function JudgeVotingPanel({ topicId, round, deadline, myVote, onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const alreadyVoted = !!myVote?.voted_at;

  async function votar(vote: "sim" | "nao") {
    setLoading(true);
    await fetch(`/api/apostas-privadas/${topicId}/votar-resultado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    setLoading(false);
    onRefresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">
        {round === 1 ? "Votação" : "Segunda Votação"} — Qual foi o resultado?
      </p>
      <p className="text-xs text-muted-foreground">
        Prazo: {new Date(deadline).toLocaleString("pt-BR")}
      </p>
      {alreadyVoted ? (
        <p className="text-sm text-primary">Você votou: {myVote.vote?.toUpperCase()}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => votar("sim")} disabled={loading}
            className="py-3 bg-sim/20 text-sim font-bold rounded-xl text-sm hover:bg-sim/30 transition-colors">
            SIM aconteceu
          </button>
          <button onClick={() => votar("nao")} disabled={loading}
            className="py-3 bg-nao/20 text-nao font-bold rounded-xl text-sm hover:bg-nao/30 transition-colors">
            NÃO aconteceu
          </button>
        </div>
      )}
    </div>
  );
}

function VoteProgress({ votes, totalJudges }: { votes: any[]; totalJudges: number }) {
  const voted = votes.filter(v => v.voted_at).length;
  const simCount = votes.filter(v => v.vote === "sim").length;
  const naoCount = votes.filter(v => v.vote === "nao").length;
  const needed = Math.ceil(totalJudges * 0.67);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Andamento da votação</p>
      <p className="text-xs text-muted-foreground">{voted}/{totalJudges} juízes votaram — precisa de {needed} votos no mesmo sentido</p>
      <div className="flex gap-4 text-sm">
        <span className="text-sim font-bold">SIM: {simCount}</span>
        <span className="text-nao font-bold">NÃO: {naoCount}</span>
        <span className="text-muted-foreground">Aguardando: {totalJudges - voted}</span>
      </div>
    </div>
  );
}
