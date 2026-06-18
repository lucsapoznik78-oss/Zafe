"use client";

/**
 * Chat Premium do evento da Comunidade.
 *
 * - isPremium:false → prévia bloqueada (cadeado + CTA "Desbloquear com Premium").
 * - isPremium:true  → lista de mensagens + caixa de envio, com polling leve.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Star, MessagesSquare, Send } from "lucide-react";

interface ChatMessage {
  id: string;
  message: string;
  created_at: string;
  user: { username: string | null; full_name: string | null } | null;
}

const MAX_LEN = 500;
const POLL_MS = 15000;

export default function CommunityChat({
  eventId,
  isPremium,
}: {
  eventId: string;
  isPremium: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(isPremium);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/comunidade/${eventId}/chat`);
      if (!r.ok) return;
      const j = await r.json();
      if (!j.locked && Array.isArray(j.messages)) setMessages(j.messages);
    } catch {
      /* silencioso — tenta de novo no próximo poll */
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!isPremium) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [isPremium, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/comunidade/${eventId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Falha ao enviar");
        return;
      }
      setMessages((prev) => [...prev, j.message]);
      setText("");
    } catch {
      setError("Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  // ── Bloqueado (free/anon): prévia borrada + CTA ─────────────────────────────
  if (!isPremium) {
    return (
      <div className="bg-card border border-primary/30 rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <MessagesSquare className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Chat do evento</span>
          <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-400/15 text-yellow-400">
            PREMIUM
          </span>
        </div>

        <div className="relative">
          <div className="blur-sm select-none pointer-events-none space-y-2">
            <div className="h-8 bg-muted rounded w-5/6" />
            <div className="h-8 bg-muted rounded w-2/3 ml-auto" />
            <div className="h-8 bg-muted rounded w-3/4" />
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 border border-primary/30">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-white font-semibold max-w-xs">
              Converse com outros previsores no chat exclusivo deste evento
            </p>
            <Link
              href="/premium"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <Star className="w-4 h-4" />
              Desbloquear com Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Premium: chat completo ──────────────────────────────────────────────────
  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessagesSquare className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-white">Chat do evento</span>
        <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-400/15 text-yellow-400">
          PREMIUM
        </span>
      </div>

      <div
        ref={listRef}
        className="max-h-72 overflow-y-auto space-y-2.5 pr-1"
      >
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-8 bg-muted rounded w-5/6" />
            <div className="h-8 bg-muted rounded w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhuma mensagem ainda. Seja o primeiro a comentar.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/u/${m.user?.username}`}
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  @{m.user?.username ?? "anônimo"}
                </Link>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-white leading-snug break-words">{m.message}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            placeholder="Escreva uma mensagem…"
            rows={2}
            className="flex-1 resize-none rounded-lg bg-background border border-border px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-black hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          {error ? (
            <span className="text-[11px] text-nao">{error}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              Enter envia · Shift+Enter quebra linha
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {text.length}/{MAX_LEN}
          </span>
        </div>
      </form>
    </div>
  );
}
