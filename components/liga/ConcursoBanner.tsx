"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";

export default function ConcursoBanner() {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
          <Trophy size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Concurso Mensal</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            30+ palpites no mês para concorrer a prêmios em dinheiro via PIX
          </p>
        </div>
      </div>
      <Link
        href="/concurso"
        className="flex-shrink-0 px-3 py-1.5 rounded-md bg-primary text-black text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        Participar
      </Link>
    </div>
  );
}
