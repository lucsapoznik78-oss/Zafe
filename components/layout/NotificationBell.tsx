"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: { topic_id?: string };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  async function load() {
    const res = await fetch("/api/notificacoes");
    if (res.ok) setNotifications(await res.json());
  }

  async function markAllRead() {
    await fetch("/api/notificacoes", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markOneRead(id: string) {
    await fetch(`/api/notificacoes/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const ICONS: Record<string, string> = {
    bet_won: "🏆",
    bet_matched: "✅",
    market_resolved: "📊",
    friend_request: "👋",
    bet_invite: "🎯",
    judge_invite: "⚖️",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative text-muted-foreground hover:text-white transition-colors p-1"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-nao text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma notificação</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`group px-4 py-3 border-b border-border last:border-0 hover:bg-white/5 transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  {n.data?.topic_id ? (
                    <Link href={`/topicos/${n.data.topic_id}`} onClick={() => setOpen(false)}>
                      <NotifContent n={n} icons={ICONS} onMarkRead={markOneRead} />
                    </Link>
                  ) : (
                    <NotifContent n={n} icons={ICONS} onMarkRead={markOneRead} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifContent({
  n,
  icons,
  onMarkRead,
}: {
  n: Notification;
  icons: Record<string, string>;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-lg shrink-0 mt-0.5">{icons[n.type] ?? "🔔"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white">{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
      {!n.read ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(n.id); }}
          title="Marcar como lida"
          className="w-4 h-4 rounded-full bg-primary shrink-0 mt-1.5 hover:bg-primary/60 transition-colors"
        />
      ) : (
        <div className="w-4 shrink-0" />
      )}
    </div>
  );
}
