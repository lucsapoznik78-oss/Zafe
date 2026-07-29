"use client";

/**
 * Canal do Usuário — conversas entre o usuário e a equipe Zafe.
 *
 * Lista de conversas + conversa aberta (chat com polling leve). O parâmetro
 * ?conversa=<id> abre direto uma conversa (usado pelas notificações).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MessagesSquare, Plus, Send, ShieldCheck } from "lucide-react";

interface Thread {
  id: string;
  subject: string;
  status: "aberto" | "respondido" | "fechado";
  last_message_at: string;
  unread_user: boolean;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  from_admin: boolean;
  created_at: string;
}

const MAX_SUBJECT = 120;
const MAX_MESSAGE = 2000;
const POLL_MS = 15000;

const STATUS_LABEL: Record<Thread["status"], string> = {
  aberto: "Aguardando equipe",
  respondido: "Respondido",
  fechado: "Encerrado",
};

const STATUS_CLASS: Record<Thread["status"], string> = {
  aberto: "bg-yellow-500/15 text-yellow-400",
  respondido: "bg-primary/15 text-primary",
  fechado: "bg-muted text-muted-foreground",
};

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CanalUsuario() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadIdUrl = searchParams.get("conversa");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(threadIdUrl);
  const [criando, setCriando] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const r = await fetch("/api/canal", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setThreads(j.threads ?? []);
    } catch {
      /* silencioso — tenta de novo no próximo poll */
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, POLL_MS);
    return () => clearInterval(t);
  }, [loadThreads]);

  function abrir(id: string) {
    setCriando(false);
    setSelectedId(id);
    router.replace(`/canal?conversa=${id}`, { scroll: false });
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread_user: false } : t)));
  }

  function voltar() {
    setSelectedId(null);
    setCriando(false);
    router.replace("/canal", { scroll: false });
    loadThreads();
  }

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      {/* Lista de conversas */}
      <aside className={`space-y-2 ${selectedId || criando ? "hidden md:block" : ""}`}>
        <button
          onClick={() => {
            setCriando(true);
            setSelectedId(null);
            router.replace("/canal", { scroll: false });
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova conversa
        </button>

        {loadingThreads ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Você ainda não tem conversas.
          </p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => abrir(t.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                t.id === selectedId
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm font-semibold text-white leading-snug break-words flex-1">
                  {t.subject}
                </span>
                {t.unread_user && (
                  <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
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

      {/* Painel: nova conversa, conversa aberta ou estado vazio */}
      <section className={`${!selectedId && !criando ? "hidden md:block" : ""}`}>
        {criando ? (
          <NovaConversa
            onCancel={() => setCriando(false)}
            onCreated={async (id) => {
              await loadThreads();
              abrir(id);
            }}
          />
        ) : selectedId ? (
          <Conversa threadId={selectedId} status={selected?.status} onBack={voltar} onSent={loadThreads} />
        ) : (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <MessagesSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-white font-semibold">Fale com a equipe Zafe</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Dúvidas sobre previsões, conta, Z$ ou o Concurso? Abra uma conversa e a
              equipe responde por aqui.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function NovaConversa({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/canal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Falha ao abrir a conversa");
        return;
      }
      onCreated(j.thread.id);
    } catch {
      setError("Falha ao abrir a conversa");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-bold text-white">Nova conversa</h2>

      <div className="space-y-1">
        <label htmlFor="canal-assunto" className="text-xs text-muted-foreground">
          Assunto
        </label>
        <input
          id="canal-assunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
          placeholder="Ex.: dúvida sobre a resolução de um evento"
          className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="canal-mensagem" className="text-xs text-muted-foreground">
          Mensagem
        </label>
        <textarea
          id="canal-mensagem"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          rows={6}
          placeholder="Conte o que aconteceu com o máximo de detalhes."
          className="w-full resize-none rounded-lg bg-background border border-border px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <div className="flex items-center justify-between">
          {error ? (
            <span className="text-[11px] text-nao">{error}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              Nunca peça nem envie senhas.
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {message.length}/{MAX_MESSAGE}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={sending || !subject.trim() || !message.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Conversa({
  threadId,
  status,
  onBack,
  onSent,
}: {
  threadId: string;
  status?: Thread["status"];
  onBack: () => void;
  onSent: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/canal/${threadId}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setMessages(j.messages ?? []);
      setSubject(j.thread?.subject ?? "");
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [threadId]);

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
      const r = await fetch(`/api/canal/${threadId}`, {
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
      onSent();
    } catch {
      setError("Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="md:hidden text-muted-foreground hover:text-white"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-white break-words">{subject || "Conversa"}</span>
        {status && (
          <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div ref={listRef} className="max-h-[55vh] min-h-[200px] overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-muted rounded w-5/6" />
            <div className="h-12 bg-muted rounded w-2/3 ml-auto" />
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.from_admin ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.from_admin ? "bg-primary/10 border border-primary/30" : "bg-background border border-border"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {m.from_admin && <ShieldCheck className="w-3 h-3 text-primary" />}
                  <span className={`text-[10px] font-bold ${m.from_admin ? "text-primary" : "text-muted-foreground"}`}>
                    {m.from_admin ? "Equipe Zafe" : "Você"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatarData(m.created_at)}</span>
                </div>
                <p className="text-sm text-white leading-snug break-words whitespace-pre-wrap">
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
            placeholder={status === "fechado" ? "Escreva para reabrir esta conversa…" : "Escreva uma mensagem…"}
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
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            {text.length}/{MAX_MESSAGE}
          </span>
        </div>
      </form>
    </div>
  );
}
