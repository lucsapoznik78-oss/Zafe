"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";

export default function EnrollButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/concurso/inscrever", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao se inscrever");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 disabled:opacity-60 transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
        Inscrever-se grátis
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      <p className="text-[10px] text-yellow-300/40 mt-1">Receba ZC$ 1.000 para competir</p>
    </div>
  );
}
