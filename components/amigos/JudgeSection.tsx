"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Check, X, ExternalLink, Clock, Shield } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Nomination {
  id: string;
  topic_id: string;
  status: string;
  availability_deadline: string | null;
  created_at: string;
  topic: { title: string; private_phase: string };
}

interface Props {
  propostos: Nomination[];   // proposed — aguardando aprovação dos dois líderes
  pendentes: Nomination[];   // both_approved — precisa confirmar disponibilidade
  ativos: Nomination[];      // active — está servindo como juiz agora
}

const PHASE_LABELS: Record<string, string> = {
  judge_confirmation: "Aguardando confirmação",
  active:             "Apostas em andamento",
  voting:             "Votação aberta",
  voting_round2:      "2ª Rodada de votação",
  resolved:           "Resolvida",
};

export default function JudgeSection({ propostos, pendentes, ativos }: Props) {
  const router = useRouter();
  const [responding, setResponding] = useState<string | null>(null);

  async function respond(nom: Nomination, disponivel: boolean) {
    setResponding(nom.id);
    await fetch(`/api/apostas-privadas/${nom.topic_id}/juizes/disponibilidade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomination_id: nom.id, disponivel }),
    });
    setResponding(null);
    router.refresh();
  }

  if (propostos.length === 0 && pendentes.length === 0 && ativos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
        <Gavel size={36} className="text-muted-foreground mx-auto" />
        <div>
          <p className="text-white font-semibold">Nenhum convite de juiz</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quando alguém indicar você como juiz em uma aposta privada, aparecerá aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Propostos — aguardando aprovação dos dois líderes */}
      {propostos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            Aguardando aprovação dos líderes
            <span className="px-1.5 py-0.5 bg-muted/40 text-muted-foreground rounded text-xs font-bold">
              {propostos.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">
            Você foi indicado como juiz. Os líderes de ambos os lados precisam aprovar.
          </p>
          {propostos.map((nom) => (
            <Link
              key={nom.id}
              href={`/apostas-privadas/${nom.topic_id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-muted/20 flex items-center justify-center shrink-0">
                <Gavel size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white line-clamp-1">{nom.topic.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Indicado — aguardando aprovação</p>
              </div>
              <ExternalLink size={14} className="text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Pendentes — precisa confirmar disponibilidade */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Convites pendentes</h2>
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold">
              {pendentes.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Você foi aprovado como juiz pelos dois líderes. Confirme se está disponível.
          </p>

          {pendentes.map((nom) => (
            <div key={nom.id} className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Gavel size={15} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/apostas-privadas/${nom.topic_id}`}
                    className="text-sm font-semibold text-white hover:text-primary transition-colors line-clamp-2 flex items-start gap-1"
                  >
                    {nom.topic.title}
                    <ExternalLink size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
                  </Link>
                  {nom.availability_deadline && (
                    <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                      <Clock size={11} />
                      Responder até{" "}
                      {new Date(nom.availability_deadline).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-300">
                Como juiz, você não aposta — apenas vota no resultado após o evento. Sua decisão (junto com outros juízes) determina o vencedor.
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => respond(nom, true)}
                  disabled={responding === nom.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sim/20 text-sim text-sm font-semibold rounded-lg hover:bg-sim/30 transition-colors disabled:opacity-50"
                >
                  <Check size={14} />
                  Aceitar
                </button>
                <button
                  onClick={() => respond(nom, false)}
                  disabled={responding === nom.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-nao/20 text-nao text-sm font-semibold rounded-lg hover:bg-nao/30 transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ativos — está servindo como juiz */}
      {ativos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            Atuando como juiz
          </h2>

          {ativos.map((nom) => (
            <Link
              key={nom.id}
              href={`/apostas-privadas/${nom.topic_id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Gavel size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white line-clamp-1">{nom.topic.title}</p>
                <p className="text-xs text-primary mt-0.5">
                  {PHASE_LABELS[nom.topic.private_phase] ?? nom.topic.private_phase}
                </p>
              </div>
              <ExternalLink size={14} className="text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
