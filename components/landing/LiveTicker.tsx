"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

interface ActivityItem {
  id: string;
  username: string;
  side: string | null;
  topic_id: string;
  topic_title: string;
  created_at: string;
}

const POLL_MS = 20000;
const ROTATE_MS = 4000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function LiveTicker() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/landing/atividade", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.activity)) setItems(data.activity);
      } catch {}
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // Rotaciona o item exibido com fade
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, 300);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const item = items[index % items.length];

  return (
    <div className="flex items-center gap-2 mb-6 px-4 py-2.5 rounded-lg border border-border bg-card/60 overflow-hidden">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      <Radio size={13} className="text-primary shrink-0" />
      <p
        className={`text-xs text-muted-foreground truncate transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-white font-medium">{item.username}</span>
        {" previu "}
        {item.side === "sim" || item.side === "nao" ? (
          <span className={item.side === "sim" ? "text-sim font-bold" : "text-nao font-bold"}>
            {item.side.toUpperCase()}
          </span>
        ) : (
          <span className="text-primary font-semibold">um resultado</span>
        )}
        {" em "}
        <span className="text-white">&ldquo;{item.topic_title}&rdquo;</span>
        <span className="text-muted-foreground/60"> · {timeAgo(item.created_at)}</span>
      </p>
    </div>
  );
}
