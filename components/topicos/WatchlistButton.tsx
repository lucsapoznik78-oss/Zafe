"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, BellRing, Loader2, Check } from "lucide-react";

interface Props {
  topicId: string;
}

export default function WatchlistButton({ topicId }: Props) {
  const [watching, setWatching] = useState(false);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/topicos/${topicId}/watchlist`)
      .then(r => r.json())
      .then(d => {
        setWatching(d.watching);
        setThreshold(d.threshold_pct ?? 10);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [topicId]);

  // Close popover on click outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function toggle() {
    if (watching) {
      setSaving(true);
      await fetch(`/api/topicos/${topicId}/watchlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setWatching(false);
      setSaving(false);
      setOpen(false);
    } else {
      setOpen(true);
    }
  }

  async function confirm() {
    setSaving(true);
    const res = await fetch(`/api/topicos/${topicId}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold_pct: threshold }),
    });
    const data = await res.json();
    setWatching(data.watching);
    setThreshold(data.threshold_pct);
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
  }

  async function updateThreshold(val: number) {
    setThreshold(val);
    if (watching) {
      await fetch(`/api/topicos/${topicId}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold_pct: val, update_only: true }),
      });
    }
  }

  if (loading) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        disabled={saving}
        title={watching ? "Deixar de seguir" : "Seguir mercado"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          watching
            ? "bg-primary/10 border-primary/40 text-primary hover:bg-nao/10 hover:border-nao/40 hover:text-nao"
            : "border-border text-muted-foreground hover:text-white hover:border-border/80"
        }`}
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : watching ? <BellRing size={12} /> : <Bell size={12} />}
        {watching ? "Seguindo" : "Seguir"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl p-4 space-y-3 z-50 shadow-xl">
          <p className="text-sm font-semibold text-white">Seguir este mercado</p>
          <p className="text-xs text-muted-foreground">
            Você receberá notificações quando a probabilidade mudar, quando faltar 2h para fechar e quando for resolvido.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Me avise se mudar mais de <span className="text-white font-semibold">{threshold}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={threshold}
              onChange={e => updateThreshold(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5%</span><span>15%</span><span>30%</span>
            </div>
          </div>

          <button
            onClick={confirm}
            disabled={saving}
            className="w-full py-2 bg-primary text-black text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <><Check size={12} /> Salvo!</> : <><BellRing size={12} /> Ativar alertas</>}
          </button>

          <button onClick={() => setOpen(false)} className="w-full text-xs text-muted-foreground hover:text-white transition-colors">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
