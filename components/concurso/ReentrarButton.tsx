"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader2 } from "lucide-react";

interface Props {
  saldoInicial: number;
  mesLabel: string;
}

export default function ReentrarButton({ saldoInicial, mesLabel }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReentrar() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/concurso/reentrar", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Sem KYC ainda → manda pro fluxo completo de inscrição.
      if (data?.needsKyc) {
        router.push("/concurso/entrar?kyc=1");
        return;
      }
      setError(data?.error ?? "Não foi possível entrar no concurso.");
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/concurso");
  }

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-6 space-y-4 text-center">
      <Trophy size={36} className="mx-auto text-yellow-400" />
      <div>
        <p className="text-lg font-bold text-yellow-400">Concurso de {mesLabel}</p>
        <p className="text-sm text-yellow-300/70 mt-1">
          Nova temporada, saldo renovado. Você já é verificado — entre com um clique
          e receba ZC$ {saldoInicial.toLocaleString("pt-BR")} para competir.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <button
        onClick={handleReentrar}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <>Entrar no Concurso de {mesLabel}</>}
      </button>
    </div>
  );
}
