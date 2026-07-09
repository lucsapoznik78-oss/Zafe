"use client";

import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

export default function EnrollButton({ saldoInicial }: { saldoInicial?: number }) {
  const router = useRouter();

  return (
    <div className="shrink-0 text-right">
      <button
        onClick={() => router.push("/concurso/entrar")}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
      >
        <Trophy size={14} />
        Participar
      </button>
      {saldoInicial != null && (
        <p className="text-[10px] text-yellow-300/40 mt-1">
          Receba ZC$ {saldoInicial.toLocaleString("pt-BR")} para competir
        </p>
      )}
    </div>
  );
}
