"use client";

/**
 * Estrela de membro Premium — clicável, abre um popover explicando o selo.
 * Distinta da estrela de reputação (esta é dourada/preenchida + tooltip).
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

export default function PremiumStar({ size = 12 }: { size?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Membro Premium"
        aria-label="Membro Premium"
        className="inline-flex items-center"
      >
        <Star size={size} className="text-yellow-400" fill="currentColor" />
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1.5 w-52 -translate-x-1/2 rounded-lg border border-yellow-400/30 bg-card px-3 py-2.5 shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <p className="flex items-center gap-1 text-xs font-bold text-yellow-400">
            <Star size={11} fill="currentColor" />
            Membro Premium
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Assinante do Zafe Premium — tem acesso a insights exclusivos e bônus
            semanal turbinado.
          </p>
          <Link
            href="/premium"
            className="mt-1.5 inline-block text-[11px] font-semibold text-primary hover:underline"
          >
            Conhecer o Premium →
          </Link>
        </div>
      )}
    </span>
  );
}
