"use client";

import { formatCurrency } from "@/lib/utils";
import { Clock, CheckSquare, RefreshCw, Wallet, TrendingUp, Zap, Users, BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  passiveTotal: number;
  walletBalance: number;
  betsLocked: number;
  commission: number;
  pendingCount: number;
  toResolveCount: number;
  totalUsers: number;
  newUsersWeek: number;
  totalBets: number;
  volumeTotal: number;
  activeUsers30d: number;
}

export default function AdminStats({ passiveTotal, walletBalance, betsLocked, commission, pendingCount, toResolveCount, totalUsers, newUsersWeek, totalBets, volumeTotal, activeUsers30d }: Props) {
  const router = useRouter();
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult] = useState("");
  const [directLoading, setDirectLoading] = useState(false);
  const [directResult, setDirectResult] = useState("");
  const [bonusLoading, setBonusLoading] = useState(false);
  const [bonusResult, setBonusResult] = useState("");

  // Auto-refresh a cada 30s
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  async function runCron() {
    setCronLoading(true);
    setCronResult("Fechando setores expirados...");

    // Passo 1: fechar setores expirados (active → resolving)
    const r1 = await fetch("/api/cron/fechar-mercados", { method: "POST" });
    const d1 = await r1.json();
    if (!r1.ok) {
      setCronResult(`❌ ${d1.error}`);
      setCronLoading(false);
      return;
    }

    const expired = d1.expired_topics ?? 0;
    setCronResult(`${expired} setor(es) fechado(s). Rodando oracle...`);

    // Passo 2: oracle resolve e paga (resolving → resolved)
    const r2 = await fetch("/api/cron/resolver-oracle", { method: "POST" });
    const d2 = await r2.json();

    if (r2.ok) {
      const parts = [`✅ ${expired} fechado(s)`];
      if (d2.paid > 0) parts.push(`${d2.paid} pago(s)`);
      if (d2.retrying > 0) parts.push(`${d2.retrying} retry agendado`);
      if (d2.total === 0) parts.push("nenhum pendente");
      if (d2.errors?.length) parts.push(`⚠️ ${d2.errors.length} erro(s): ${d2.errors[0]}`);
      setCronResult(parts.join(" · "));
    } else {
      setCronResult(`✅ ${expired} fechado(s) · ⚠️ oracle: ${d2.error ?? "erro desconhecido"}`);
    }

    setCronLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Linha 1: usuários e atividade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-primary"><Users size={18} /></div>
          <p className="text-2xl font-bold text-white">{totalUsers.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Usuários cadastrados</p>
          <p className="text-[10px] text-sim mt-0.5">+{newUsersWeek} essa semana</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-primary"><Users size={18} /></div>
          <p className="text-2xl font-bold text-white">{activeUsers30d.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Ativos (30 dias)</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-primary"><BarChart2 size={18} /></div>
          <p className="text-2xl font-bold text-white">{totalBets.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">Palpites realizados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-primary"><TrendingUp size={18} /></div>
          <p className="text-2xl font-bold text-white">{formatCurrency(volumeTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">Volume total Z$</p>
        </div>
      </div>

      {/* Linha 2: financeiro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="mb-2 text-yellow-400"><Wallet size={18} /></div>
          <p className="text-2xl font-bold text-yellow-400">{formatCurrency(passiveTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">Saldo passivo total</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Saldos Z$: {formatCurrency(walletBalance)} · Palpites ativos: {formatCurrency(betsLocked)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-primary"><TrendingUp size={18} /></div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(commission)}</p>
          <p className="text-xs text-muted-foreground mt-1">Comissões acumuladas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-yellow-400"><Clock size={18} /></div>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Aguardando aprovação</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="mb-2 text-yellow-400"><CheckSquare size={18} /></div>
          <p className="text-2xl font-bold text-yellow-400">{toResolveCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Setores p/ resolver</p>
        </div>
      </div>

      {/* Botão direto — resolve tudo agora */}
      <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Resolver setores agora</p>
          <p className="text-xs text-muted-foreground">Claude decide o resultado e distribui o saldo Z$ imediatamente.</p>
          {directResult && <p className="text-xs mt-1 text-primary">{directResult}</p>}
        </div>
        <button
          onClick={async () => {
            setDirectLoading(true);
            setDirectResult("Consultando Claude...");
            const res = await fetch("/api/admin/resolver-direto", { method: "POST" });
            const d = await res.json();
            if (res.ok) {
              setDirectResult(d.resolved > 0
                ? `✅ ${d.resolved}/${d.total} setor(es) resolvido(s): ${d.results?.map((r: any) => `${r.outcome}`).join(", ")}`
                : `⚠️ Nenhum resolvido: ${d.results?.map((r: any) => r.outcome).join(", ") || d.message}`
              );
            } else {
              setDirectResult(`❌ ${d.error}`);
            }
            setDirectLoading(false);
            router.refresh();
          }}
          disabled={directLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
        >
          <Zap size={14} className={directLoading ? "animate-pulse" : ""} />
          {directLoading ? "Resolvendo..." : "Resolver agora"}
        </button>
      </div>

      {/* Bônus semanal */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Bônus semanal (Z$ 100)</p>
          <p className="text-xs text-muted-foreground">Credita Z$ 100 para todos os usuários com menos de Z$ 1.000 no saldo Z$.</p>
          {bonusResult && <p className="text-xs mt-1 text-primary">{bonusResult}</p>}
        </div>
        <button
          onClick={async () => {
            setBonusLoading(true);
            setBonusResult("Creditando...");
            const res = await fetch("/api/cron/bonus-semanal", { method: "POST" });
            const d = await res.json();
            setBonusResult(res.ok ? `✅ ${d.credited} usuário(s) creditados, ${d.skipped} ignorados (já no teto)` : `❌ ${d.error}`);
            setBonusLoading(false);
            router.refresh();
          }}
          disabled={bonusLoading}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-white text-sm rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors shrink-0"
        >
          <Zap size={14} className={bonusLoading ? "animate-pulse" : ""} />
          {bonusLoading ? "Creditando..." : "Dar bônus"}
        </button>
      </div>

      {/* Botão de manutenção */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Fechar + Resolver setores</p>
          <p className="text-xs text-muted-foreground">
            1) Fecha expirados · 2) Oracle (API + Claude AI) determina resultado · 3) Distribui fundos automaticamente
          </p>
          {cronResult && <p className="text-xs mt-1 text-primary">{cronResult}</p>}
        </div>
        <button
          onClick={runCron}
          disabled={cronLoading}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-white text-sm rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw size={14} className={cronLoading ? "animate-spin" : ""} />
          {cronLoading ? "Rodando..." : "Rodar agora"}
        </button>
      </div>
    </div>
  );
}
