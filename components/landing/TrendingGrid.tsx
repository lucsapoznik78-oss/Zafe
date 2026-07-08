"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopicCard from "@/components/topicos/TopicCard";
import type { TopicWithStats } from "@/types/database";

const POLL_MS = 15000;

interface Flash {
  direction: "up" | "down";
  nonce: number;
}

// Grid dos eventos em alta com atualização ao vivo: quando a probabilidade
// de um tópico muda entre polls, o card pisca verde (subiu SIM) ou vermelho (caiu).
export default function TrendingGrid({ initialTopics }: { initialTopics: TopicWithStats[] }) {
  const router = useRouter();
  const [topics, setTopics] = useState(initialTopics);
  const [flashes, setFlashes] = useState<Record<string, Flash>>({});
  const prevProbs = useRef<Record<string, number>>({});

  // Palpite de visitante: guarda a escolha e leva pro cadastro.
  // Após o login, o PendingPickActivator retoma o palpite no evento.
  function guestPick(topicId: string, side: "sim" | "nao") {
    localStorage.setItem(
      "zafe_pending_pick",
      JSON.stringify({ topic_id: topicId, side, saved_at: Date.now() })
    );
    router.push("/login");
  }

  useEffect(() => {
    const ids = initialTopics.map((t) => t.id).join(",");
    if (!ids) return;

    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/landing/atividade?ids=${ids}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const statsMap = new Map<string, any>(
          (data.stats ?? []).map((s: any) => [s.topic_id, s])
        );
        if (!alive || statsMap.size === 0) return;

        const newFlashes: Record<string, Flash> = {};
        setTopics((current) =>
          current.map((t) => {
            const stats = statsMap.get(t.id);
            if (!stats) return t;
            const prob = stats.prob_sim ?? 0.5;
            const prev = prevProbs.current[t.id];
            if (prev !== undefined && Math.abs(prob - prev) > 0.001) {
              newFlashes[t.id] = { direction: prob > prev ? "up" : "down", nonce: Date.now() };
            }
            prevProbs.current[t.id] = prob;
            return { ...t, stats };
          })
        );
        if (Object.keys(newFlashes).length > 0) {
          setFlashes((f) => ({ ...f, ...newFlashes }));
        }
      } catch {}
    }

    // registra probabilidades iniciais sem piscar
    for (const t of initialTopics) {
      prevProbs.current[t.id] = t.stats?.prob_sim ?? 0.5;
    }
    const interval = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [initialTopics]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {topics.map((topic) => {
        const flash = flashes[topic.id];
        return (
          <div
            key={flash ? `${topic.id}-${flash.nonce}` : topic.id}
            className={`flex flex-col rounded-xl ${
              flash
                ? flash.direction === "up"
                  ? "animate-odds-pulse-up"
                  : "animate-odds-pulse-down"
                : ""
            }`}
          >
            <div className="flex-1">
              <TopicCard topic={topic} href={`/liga/${topic.id}`} />
            </div>
            {topic.market_type !== "multi" && topic.status === "active" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => guestPick(topic.id, "sim")}
                  className="py-1.5 rounded-lg text-xs font-bold bg-sim/10 text-sim hover:bg-sim/20 transition-colors"
                >
                  Prever SIM
                </button>
                <button
                  onClick={() => guestPick(topic.id, "nao")}
                  className="py-1.5 rounded-lg text-xs font-bold bg-nao/10 text-nao hover:bg-nao/20 transition-colors"
                >
                  Prever NÃO
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
