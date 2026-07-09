"use client";

/**
 * Gestão de usuários no admin (audit #21): busca, visão de carteira,
 * banir/reativar e ajuste manual de Z$ (com motivo obrigatório).
 */
import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, Ban, RotateCcw, Coins, Star, Activity } from "lucide-react";
import { isPremium } from "@/lib/premium";

interface AdminUser {
  id: string;
  username: string | null;
  full_name: string | null;
  is_admin: boolean;
  banned: boolean;
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
  balance: number | null;
  self_excluded_until: string | null;
  cooloff_until: string | null;
  palpites30d: number;
}

interface SemanaAtividade {
  indice: number;
  inicio: string;
  fim: string;
  palpites: number;
  diasAtivos: number;
  sessoes: number;
  minutosEstimados: number;
}

interface AtividadeResp {
  semanas: SemanaAtividade[];
  jogoResponsavel: {
    banned: boolean;
    cooloffAtivo: boolean;
    cooloff_until: string | null;
    autoexcluido: boolean;
    self_excluded_until: string | null;
  };
}

function fmtZ(v: number | null) {
  if (v === null) return "—";
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function fmtDuracao(min: number) {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function rotuloSemana(i: number) {
  if (i === 0) return "Esta semana";
  if (i === 1) return "1 semana atrás";
  return `${i} semanas atrás`;
}

function pausaAtiva(u: AdminUser) {
  const now = Date.now();
  const auto = u.self_excluded_until && new Date(u.self_excluded_until).getTime() > now;
  const cool = u.cooloff_until && new Date(u.cooloff_until).getTime() > now;
  if (auto) return "autoexcluido" as const;
  if (cool) return "pausa" as const;
  return null;
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
  const [atividadeId, setAtividadeId] = useState<string | null>(null);
  const [atividade, setAtividade] = useState<AtividadeResp | null>(null);
  const [atividadeLoading, setAtividadeLoading] = useState(false);

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

  async function toggleAtividade(u: AdminUser) {
    if (atividadeId === u.id) {
      setAtividadeId(null);
      setAtividade(null);
      return;
    }
    setAtividadeId(u.id);
    setAtividade(null);
    setAtividadeLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/atividade`);
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro ao carregar atividade");
        setAtividadeId(null);
      } else {
        setAtividade(data);
      }
    } catch {
      setMsg("Falha de rede ao carregar atividade.");
      setAtividadeId(null);
    } finally {
      setAtividadeLoading(false);
    }
  }

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

  async function togglePremium(u: AdminUser) {
    const ativo = isPremium(u);
    let premium_days: number | undefined;
    if (!ativo) {
      const resp = prompt(
        `Ativar Premium para @${u.username ?? u.id.slice(0, 8)}.\n` +
          `Dias de validade (vazio = vitalício):`,
        "30"
      );
      if (resp === null) return; // cancelado
      const n = Number(resp.trim());
      if (resp.trim() !== "" && (!Number.isFinite(n) || n <= 0)) {
        setMsg("Dias inválidos.");
        return;
      }
      if (resp.trim() !== "") premium_days = n;
    } else {
      if (!confirm(`Desativar Premium de @${u.username ?? u.id.slice(0, 8)}?`)) return;
    }
    setBusyId(u.id);
    setMsg("");
    const res = await fetch(`/api/admin/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_premium: !ativo, premium_days }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Erro ao atualizar Premium");
    } else {
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, is_premium: data.is_premium, premium_until: data.premium_until }
            : x
        )
      );
    }
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
          {users.map((u, i) => (
            <div key={u.id} className="p-4 bg-card space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-6 shrink-0 text-right">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      @{u.username ?? u.id.slice(0, 8)}
                      {u.is_admin && <span className="ml-2 text-[10px] text-primary font-semibold">ADMIN</span>}
                      {isPremium(u) && <span className="ml-2 text-[10px] text-yellow-400 font-semibold">PREMIUM</span>}
                      {u.banned && <span className="ml-2 text-[10px] text-destructive font-semibold">BANIDO</span>}
                      {pausaAtiva(u) === "autoexcluido" && <span className="ml-2 text-[10px] text-red-400 font-semibold">AUTOEXCLUÍDO</span>}
                      {pausaAtiva(u) === "pausa" && <span className="ml-2 text-[10px] text-violet-300 font-semibold">EM PAUSA</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.full_name ?? "—"}
                      <span className="ml-2 text-primary/70">· {u.palpites30d} palpite{u.palpites30d === 1 ? "" : "s"}/30d</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary tabular-nums">{fmtZ(u.balance)}</span>
                  <button
                    onClick={() => toggleAtividade(u)}
                    className={`p-2 rounded-lg border transition-colors ${
                      atividadeId === u.id
                        ? "border-primary/50 text-primary"
                        : "border-border text-muted-foreground hover:text-white hover:border-primary/50"
                    }`}
                    title="Monitoramento / jogo responsável"
                  >
                    <Activity size={14} />
                  </button>
                  <button
                    onClick={() => togglePremium(u)}
                    disabled={busyId === u.id}
                    className={`p-2 rounded-lg border transition-colors disabled:opacity-40 ${
                      isPremium(u)
                        ? "border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10"
                        : "border-border text-muted-foreground hover:text-yellow-400 hover:border-yellow-400/50"
                    }`}
                    title={isPremium(u) ? "Desativar Premium" : "Ativar Premium"}
                  >
                    {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={isPremium(u) ? "currentColor" : "none"} />}
                  </button>
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
                    className="px-4 py-2 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
                  </button>
                </div>
              )}

              {atividadeId === u.id && (
                <div className="bg-background/60 border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-primary" />
                    <p className="text-xs font-semibold text-white">Monitoramento — jogo responsável</p>
                  </div>

                  {atividadeLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : atividade ? (
                    <>
                      {/* Status de jogo responsável */}
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {atividade.jogoResponsavel.banned && (
                          <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">Banido</span>
                        )}
                        {atividade.jogoResponsavel.autoexcluido && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">
                            Autoexcluído até {new Date(atividade.jogoResponsavel.self_excluded_until!).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {atividade.jogoResponsavel.cooloffAtivo && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-semibold">
                            Em pausa até {new Date(atividade.jogoResponsavel.cooloff_until!).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {!atividade.jogoResponsavel.banned &&
                          !atividade.jogoResponsavel.autoexcluido &&
                          !atividade.jogoResponsavel.cooloffAtivo && (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Sem restrições ativas</span>
                          )}
                      </div>

                      {/* Tempo estimado por semana */}
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-2 px-3 py-2 bg-card text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          <span>Semana</span>
                          <span className="text-right">Tempo est.</span>
                          <span className="text-right">Palpites</span>
                          <span className="text-right">Dias</span>
                        </div>
                        {atividade.semanas.map((s) => (
                          <div
                            key={s.indice}
                            className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-2 px-3 py-2 border-t border-border text-xs"
                          >
                            <span className="text-white">{rotuloSemana(s.indice)}</span>
                            <span className="text-right text-primary font-semibold tabular-nums">{fmtDuracao(s.minutosEstimados)}</span>
                            <span className="text-right text-muted-foreground tabular-nums">{s.palpites}</span>
                            <span className="text-right text-muted-foreground tabular-nums">{s.diasAtivos}/7</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                        Tempo estimado a partir da atividade de palpites (sessões agrupadas por
                        inatividade de 30 min). A plataforma não cronometra sessão de navegação —
                        é um indicador de engajamento para fins de jogo responsável.
                      </p>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
