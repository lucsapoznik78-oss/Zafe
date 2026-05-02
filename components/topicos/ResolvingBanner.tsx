"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  topicId: string;
}

export default function ResolvingBanner({ topicId }: Props) {
  const router = useRouter();
  const [dots, setDots] = useState(".");
  const [elapsed, setElapsed] = useState(0);

  // Animação de pontos
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 600);
    return () => clearInterval(t);
  }, []);

  // Polling a cada 5s para verificar se o mercado foi resolvido
  useEffect(() => {
    const apiPath = `/api/topicos/${topicId}/status`;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiPath);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "resolved" || data.status === "cancelled") {
          router.refresh();
        }
        setElapsed((e) => e + 5);
      } catch {
        // silent
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [topicId, router]);

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-4 flex items-start gap-4">
      <Loader2 size={20} className="text-yellow-400 animate-spin mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yellow-300">
          Aguardando resolução{dots}
        </p>
        <p className="text-xs text-yellow-400/70 mt-1 leading-relaxed">
          O oracle de IA está analisando o resultado deste setor. Isso costuma levar entre 30 segundos e 2 minutos.
          A página atualiza automaticamente assim que o resultado for publicado.
        </p>
        {elapsed >= 120 && (
          <p className="text-xs text-muted-foreground mt-2">
            Demorando mais que o esperado — um admin da Zafe irá resolver manualmente em breve.
          </p>
        )}
      </div>
    </div>
  );
}
