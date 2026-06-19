"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function StreamerLinkCopy({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-input border border-border px-3 py-2 text-sm text-white">
        {link}
      </code>
      <button
        onClick={copy}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-300 px-3 py-2 text-xs font-bold hover:bg-violet-500/30 transition-colors"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
