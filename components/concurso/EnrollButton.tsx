"use client";

import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";

export default function EnrollButton() {
  const router = useRouter();

  return (
    <div className="shrink-0 text-right">
      <button
        onClick={() => router.push("/concurso/entrar")}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors"
      >
        <Trophy size={14} />
        Inscrever-se grátis
      </button>
      <p className="text-[10px] text-yellow-300/40 mt-1">Receba ZC$ 1.000 para competir</p>
    </div>
  );
}
