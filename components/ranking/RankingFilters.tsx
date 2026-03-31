"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PERIODOS = [
  { key: "todos", label: "Todos os tempos" },
  { key: "mes",   label: "Este mês" },
  { key: "semana", label: "Esta semana" },
];

export default function RankingFilters({ periodo }: { periodo: string }) {
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
      {PERIODOS.map((p) => (
        <Link
          key={p.key}
          href={`/ranking?periodo=${p.key}`}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            periodo === p.key
              ? "bg-card text-white"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
