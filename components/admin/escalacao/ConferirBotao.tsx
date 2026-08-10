"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Roda a conferência de novo sem sair da página. A página já mostra o resultado
 * do último render; isso aqui existe para quando o admin acabou de lançar stats
 * numa outra aba e quer ver o efeito na emissão sem recarregar no braço.
 */
export default function ConferirBotao({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function conferir() {
    setErro(null);
    setRodando(true);
    const res = await fetch(`/api/admin/escalacao/${cardId}/conferir`);
    setRodando(false);
    if (!res.ok) {
      setErro((await res.json()).error ?? "Falha");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      {erro && <span className="text-[11px] text-nao">{erro}</span>}
      <button
        onClick={conferir}
        disabled={rodando}
        className="px-2.5 py-1 rounded-lg bg-input border border-border text-[11px] font-semibold text-white hover:bg-white/5 disabled:opacity-50 transition-colors"
      >
        {rodando ? <Loader2 size={12} className="animate-spin" /> : "Conferir de novo"}
      </button>
    </span>
  );
}
