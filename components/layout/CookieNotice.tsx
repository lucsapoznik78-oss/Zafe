"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "zafe_cookie_notice_v1";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage indisponível (ex.: modo privado antigo) — não mostra o aviso
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // sem localStorage o aviso some só nesta sessão
    }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 md:left-auto md:right-4 md:max-w-sm z-[60] rounded-xl border border-border bg-black/95 backdrop-blur-sm p-4 shadow-lg"
    >
      <p className="text-xs text-muted-foreground leading-relaxed">
        A Zafe usa apenas cookies essenciais: para manter você conectado e
        reconhecer convites de amigos. Não usamos cookies de publicidade nem de
        rastreamento.{" "}
        <Link href="/termos" className="underline hover:text-white transition-colors">
          Saiba mais
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="mt-3 w-full md:w-auto px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        Entendi
      </button>
    </div>
  );
}
