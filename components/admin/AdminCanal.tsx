"use client";

/**
 * Canal do Usuário — painel do admin.
 *
 * Fila de conversas (filtrável por status) + conversa aberta, onde o admin
 * responde e fecha/reabre o atendimento.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ShieldCheck, User } from "lucide-react";

type Status = "aberto" | "respondido" | "fechado";

interface Thread {
  id: string;
  subject: string;
  status: Status;
  last_message_at: string;
  unread_admin: boolean;
  created_at: string;
  user: { id: string; username: string | null; full_name: string | null } | null;
  preview: { message: string; from_admin: boolean } | null;
}

interface Message {
  id: string;
  message: string;
  from_admin: boolean;
  created_at: string;
}

const MAX_MESSAGE = 2000;
const POLL_MS = 15000;

const STATUS_LABEL: Record<Status, string> = {
  aberto: "Aguardando resposta",
  respondido: "Respondido",
  fechado: "Encerrado",
};

const STATUS_CLASS: Record<Status, string> = {
  aberto: "bg-prize/15 text-prize",
  respondido: "bg-primary/15 text-primary",
  fechado: "bg-muted text-muted-foreground",
};

const FILTROS: { value: Status | "todos"; label: string }[] = [
  { value: "aberto", label: "Abertas" },
  { value: "respondido", label: "Respondidas" },
  { value: "fechado", label: "Encerradas" },
  { value: "todos", label: "Todas" },
];

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCanal() {
  const [filtro, setFiltro] = useState<Status | "todos">("aberto");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = filtro === "todos" ? "" : `?status=${filtro}`;
      const r = await fetch(`/api/admin/canal${qs}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setThreads(j.threads ?? []);
    } catch {
      /* silencioso — tenta de novo no próximo poll */
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFiltro(f.value);
              setSelectedId(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              filtro === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        <aside className={`space-y-2 ${selectedId ? "hidden md:block" : ""}`}>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-20 bg-muted rounded-lg" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma conversa neste filtro.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedId(t.id);
                  setThreads((prev) =>
                    prev.map((x) => (x.id === t.id ? { ...x, unread_admin: false } : x)),
                  );
                }}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  t.id === selectedId
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-foreground leading-snug break-words flex-1">
                    {t.subject}
                  </span>
                  {t.unread_admin && (
                    <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {t.user?.username ? `@${t.user.username}` : t.user?.full_name ?? "usuário"}
                </p>
                {t.preview && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-1">
                    {t.preview.from_admin ? "Equipe: " : ""}
                    {t.preview.message}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CLASS[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatarData(t.last_message_at)}
                  </span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section className={`${!selectedId ? "hidden md:block" : ""}`}>
          {selected ? (
            <AdminConversa
              thread={selected}
              onBack={() => setSelectedId(null)}
              onChanged={load}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Selecione uma conversa para responder.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AdminConversa({
  thread,
  onBack,
  onChanged,
}: {
  thread: Thread;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/canal/${thread.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setMessages(j.messages ?? []);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [thread.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

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
      const r = await fetch(`/api/admin/canal/${thread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Falha ao responder");
        return;
      }
      setMessages((prev) => [...prev, j.message]);
      setText("");
      onChanged();
    } catch {
      setError("Falha ao responder");
    } finally {
      setSending(false);
    }
  }

  async function mudarStatus(status: "fechado" | "aberto") {
    const r = await fetch(`/api/admin/canal/${thread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) onChanged();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground break-words">{thread.subject}</p>
          <p className="text-[11px] text-muted-foreground">
            {thread.user?.full_name ?? "—"}
            {thread.user?.username ? ` · @${thread.user.username}` : ""}
          </p>
        </div>
        <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${STATUS_CLASS[thread.status]}`}>
          {STATUS_LABEL[thread.status]}
        </span>
      </div>

      <div ref={listRef} className="max-h-[55vh] min-h-[200px] overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-muted rounded w-5/6" />
            <div className="h-12 bg-muted rounded w-2/3 ml-auto" />
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from_admin ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.from_admin ? "bg-primary/10 border border-primary/30" : "bg-background border border-border"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {m.from_admin && <ShieldCheck className="w-3 h-3 text-primary" />}
                  <span className={`text-[10px] font-bold ${m.from_admin ? "text-primary" : "text-muted-foreground"}`}>
                    {m.from_admin ? "Equipe Zafe" : thread.user?.username ? `@${thread.user.username}` : "Usuário"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatarData(m.created_at)}</span>
                </div>
                <p className="text-sm text-foreground leading-snug break-words whitespace-pre-wrap">
                  {m.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))}
            placeholder="Responder ao usuário…"
            rows={3}
            className="flex-1 resize-none rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
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
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Responder"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <span className="text-[11px] text-nao">{error}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              Enter envia · Shift+Enter quebra linha
            </span>
          )}
          <button
            type="button"
            onClick={() => mudarStatus(thread.status === "fechado" ? "aberto" : "fechado")}
            className="text-[11px] text-muted-foreground hover:text-foreground underline shrink-0"
          >
            {thread.status === "fechado" ? "Reabrir conversa" : "Encerrar conversa"}
          </button>
        </div>
      </form>
    </div>
  );
}
