"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  cardId: string;
  acao: "publicar" | "recalcular";
}

const TEXTO = {
  publicar: {
    botao: "Publicar card",
    aviso:
      "Publicar é de mão única: preço, tamanho de time, teto e prazo congelam (Art. 33) e o card fica visível.",
  },
  recalcular: {
    botao: "Recalcular apuração",
    aviso:
      "Recalcular é reversível e recomputa tudo do zero. Não paga nada — pagar é outra ação.",
  },
} as const;

export default function CardAcoes({ cardId, acao }: Props) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function executar() {
    setErro(null);
    setOk(null);
    setRodando(true);
    const res = await fetch(`/api/admin/escalacao/${cardId}/${acao}`, { method: "POST" });
    const json = await res.json();
    setRodando(false);
    if (!res.ok) {
      setErro(json.error ?? "Falha");
      return;
    }
    setOk(
      acao === "recalcular"
        ? `${json.atletasCalculados} atletas e ${json.timesCalculados} times apurados`
        : "Card publicado"
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={executar}
        disabled={rodando}
        className="w-full py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {rodando ? <Loader2 size={14} className="animate-spin mx-auto" /> : TEXTO[acao].botao}
      </button>
      <p className="text-[10px] text-muted-foreground">{TEXTO[acao].aviso}</p>
      {erro && <p className="text-xs text-nao">{erro}</p>}
      {ok && <p className="text-xs text-sim">{ok}</p>}
    </div>
  );
}
