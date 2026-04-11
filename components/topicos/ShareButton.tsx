"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

interface Props {
  title: string;
  probSim: number;
  slug?: string | null;
  topicId: string;
}

export default function ShareButton({ title, probSim, slug, topicId }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://zafe-rho.vercel.app";
  const path = slug ? `/topicos/${slug}` : `/topicos/${topicId}`;
  const url = `${baseUrl}${path}`;
  const text = `${title} — SIM ${(probSim * 100).toFixed(0)}% · NÃO ${(100 - probSim * 100).toFixed(0)}% | Zafe`;

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:text-white hover:border-white/30 transition-colors"
      >
        <Share2 size={13} />
        Compartilhar
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 bg-card border border-border rounded-xl p-3 space-y-2 w-48 shadow-xl">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition-colors">
              <span className="text-base">💬</span> WhatsApp
            </a>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition-colors">
              <span className="text-base">𝕏</span> Twitter / X
            </a>
            <button onClick={() => { handleCopy(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-white hover:bg-white/5 transition-colors">
              {copied ? <Check size={13} className="text-sim" /> : <Copy size={13} />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
