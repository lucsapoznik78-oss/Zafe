"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import type { Topic } from "@/types/database";

interface Props {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

export default function PrivateBetModal({ friendId, friendName, onClose }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [topics, setTopics] = useState<Pick<Topic, "id" | "title">[]>([]);
  const [form, setForm] = useState({
    topic_id: "",
    inviter_side: "sim" as "sim" | "nao",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("topics").select("id, title").eq("status", "active").limit(20)
      .then(({ data }) => setTopics(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.topic_id || !form.amount) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    const res = await fetch("/api/amigos/convidar-aposta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, invitee_id: friendId, amount: parseFloat(form.amount) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erro ao enviar convite"); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-md z-10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Bolão com {friendName}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tópico</label>
            <select
              value={form.topic_id}
              onChange={(e) => setForm((f) => ({ ...f, topic_id: e.target.value }))}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
            >
              <option value="">Selecione um tópico...</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Seu palpite</label>
            <div className="grid grid-cols-2 gap-2">
              {(["sim", "nao"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, inviter_side: side }))}
                  className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                    form.inviter_side === side
                      ? side === "sim" ? "bg-sim text-black" : "bg-nao text-black"
                      : side === "sim" ? "bg-sim/10 text-sim" : "bg-nao/10 text-nao"
                  }`}
                >
                  {side.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {friendName} ficará automaticamente no lado {form.inviter_side === "sim" ? "NÃO" : "SIM"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Valor por pessoa (Z$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Z$</span>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                min="1"
                className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Enviar Convite"}
          </button>
        </form>
      </div>
    </div>
  );
}
