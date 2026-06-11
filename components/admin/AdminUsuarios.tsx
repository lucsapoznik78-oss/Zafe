"use client";

/**
 * Gestão de usuários no admin (audit #21): busca, visão de carteira,
 * banir/reativar e ajuste manual de Z$ (com motivo obrigatório).
 */
import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, Ban, RotateCcw, Coins } from "lucide-react";

interface AdminUser {
  id: string;
  username: string | null;
  full_name: string | null;
  is_admin: boolean;
  banned: boolean;
  created_at: string;
  balance: number | null;
}

function fmtZ(v: number | null) {
  if (v === null) return "—";
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default function AdminUsuarios() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");

  const fetchUsers = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/usuarios?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setUsers(res.ok ? data.users : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(q), 300);
    return () => clearTimeout(t);
  }, [q, fetchUsers]);

  async function toggleBan(u: AdminUser) {
    const acao = u.banned ? "reativar" : "banir";
    if (!confirm(`Tem certeza que deseja ${acao} @${u.username ?? u.id.slice(0, 8)}?`)) return;
    setBusyId(u.id);
    setMsg("");
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !u.banned }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error ?? "Erro ao atualizar usuário");
    else setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, banned: !u.banned } : x)));
    setBusyId(null);
  }

  async function submitAdjust(u: AdminUser) {
    const valor = Number(amount.replace(",", "."));
    if (!Number.isFinite(valor) || valor === 0 || !motivo.trim()) {
      setMsg("Informe um valor (± Z$) e o motivo do ajuste.");
      return;
    }
    setBusyId(u.id);
    setMsg("");
    const res = await fetch(`/api/admin/usuarios/${u.id}/ajustar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: valor, motivo: motivo.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Erro ao ajustar saldo");
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, balance: data.balance } : x)));
      setAdjustId(null);
      setAmount("");
      setMotivo("");
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por username ou nome…"
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
        />
      </div>

      {msg && <p className="text-destructive text-xs">{msg}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground p-5 text-center">Nenhum usuário encontrado.</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="p-4 bg-card space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    @{u.username ?? u.id.slice(0, 8)}
                    {u.is_admin && <span className="ml-2 text-[10px] text-primary font-semibold">ADMIN</span>}
                    {u.banned && <span className="ml-2 text-[10px] text-destructive font-semibold">BANIDO</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.full_name ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary tabular-nums">{fmtZ(u.balance)}</span>
                  <button
                    onClick={() => { setAdjustId(adjustId === u.id ? null : u.id); setMsg(""); }}
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-white hover:border-primary/50 transition-colors"
                    title="Ajustar saldo"
                  >
                    <Coins size={14} />
                  </button>
                  <button
                    onClick={() => toggleBan(u)}
                    disabled={busyId === u.id || u.is_admin}
                    className={`p-2 rounded-lg border transition-colors disabled:opacity-40 ${
                      u.banned
                        ? "border-primary/40 text-primary hover:bg-primary/10"
                        : "border-destructive/40 text-destructive hover:bg-destructive/10"
                    }`}
                    title={u.banned ? "Reativar conta" : "Banir conta"}
                  >
                    {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : u.banned ? <RotateCcw size={14} /> : <Ban size={14} />}
                  </button>
                </div>
              </div>

              {adjustId === u.id && (
                <div className="flex gap-2 flex-wrap items-center bg-background/60 border border-border rounded-lg p-3">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="± valor (ex: -50)"
                    inputMode="decimal"
                    className="w-32 bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo do ajuste (obrigatório)"
                    className="flex-1 min-w-[180px] bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => submitAdjust(u)}
                    disabled={busyId === u.id}
                    className="px-4 py-2 bg-primary text-black font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
