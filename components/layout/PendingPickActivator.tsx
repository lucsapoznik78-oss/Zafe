"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const KEY = "zafe_pending_pick";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Retoma o palpite iniciado na landing por um visitante sem conta:
// após login/cadastro, redireciona uma única vez para o evento com o
// lado pré-selecionado (/liga/[id]?side=sim|nao).
export default function PendingPickActivator() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    localStorage.removeItem(KEY);

    try {
      const pick = JSON.parse(raw);
      if (
        typeof pick.topic_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(pick.topic_id) ||
        (pick.side !== "sim" && pick.side !== "nao") ||
        typeof pick.saved_at !== "number" ||
        Date.now() - pick.saved_at > MAX_AGE_MS
      ) {
        return;
      }
      router.replace(`/liga/${pick.topic_id}?side=${pick.side}`);
    } catch {}
  }, [router]);

  return null;
}
