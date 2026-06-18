import Link from "next/link";

const TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "Todas" },
  { key: "group", label: "Grupos" },
  { key: "r32", label: "32 avos" },
  { key: "r16", label: "Oitavas" },
  { key: "qf", label: "Quartas" },
  { key: "sf", label: "Semis" },
  { key: "third", label: "3º lugar" },
  { key: "final", label: "Final" },
];

export default function StageTabs({ current }: { current: string }) {
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.key ? `/copa?stage=${t.key}` : "/copa"}
          className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
            current === t.key ? "bg-amber-400/20 text-amber-400" : "text-muted-foreground hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
