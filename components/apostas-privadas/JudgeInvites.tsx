"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Check, X, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Nomination {
  id: string;
  topic_id: string;
  availability_deadline: string;
  topic: { title: string };
}

interface Props {
  nominations: Nomination[];
}

export default function JudgeInvites({ nominations }: Props) {
  const router = useRouter();
  const [responding, setResponding] = useState<string | null>(null);

  async function respond(nomination: Nomination, disponivel: boolean) {
    setResponding(nomination.id);
    await fetch(`/api/apostas-privadas/${nomination.topic_id}/juizes/disponibilidade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomination_id: nomination.id, disponivel }),
    });
    setResponding(null);
    router.refresh();
  }

  if (nominations.length === 0) return null;

  return (
    <div className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Gavel size={15} className="text-yellow-400" />
        Convites de Juiz
        <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
          {nominations.length}
        </span>
      </h3>
      <p className="text-xs text-muted-foreground -mt-1">
        Você foi aprovado como juiz nestes bolões. Confirme se está disponível.
      </p>

      {nominations.map((nom) => (
        <div key={nom.id} className="flex items-start justify-between gap-3 bg-background/50 rounded-lg p-3">
          <div className="flex-1 min-w-0">
            <Link
              href={`/apostas-privadas/${nom.topic_id}`}
              className="text-sm font-medium text-white line-clamp-2 hover:text-primary transition-colors flex items-start gap-1"
            >
              {nom.topic.title}
              <ExternalLink size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              Prazo: {new Date(nom.availability_deadline).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => respond(nom, true)}
              disabled={responding === nom.id}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-sim/20 text-sim text-xs font-medium rounded-lg hover:bg-sim/30 transition-colors disabled:opacity-50"
            >
              <Check size={12} />
              Aceitar
            </button>
            <button
              onClick={() => respond(nom, false)}
              disabled={responding === nom.id}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-nao/20 text-nao text-xs font-medium rounded-lg hover:bg-nao/30 transition-colors disabled:opacity-50"
            >
              <X size={12} />
              Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
