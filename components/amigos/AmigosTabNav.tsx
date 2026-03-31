"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users, Gavel } from "lucide-react";

interface Props {
  pendingJudge: number;
}

export default function AmigosTabNav({ pendingJudge }: Props) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "amigos";

  const tabs = [
    { key: "amigos", label: "Amigos", icon: Users, badge: 0 },
    { key: "juiz",   label: "Juiz",   icon: Gavel, badge: pendingJudge },
  ];

  return (
    <div className="flex border-b border-border">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <Link
            key={t.key}
            href={`/amigos?tab=${t.key}`}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active
                ? "text-white border-primary"
                : "text-muted-foreground border-transparent hover:text-white"
            }`}
          >
            <Icon size={15} />
            {t.label}
            {t.badge > 0 && (
              <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded-full leading-none">
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
