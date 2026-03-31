"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { FileText, Loader2, TrendingUp, Wallet, ArrowRightLeft } from "lucide-react";

interface Relatorio {
  periodo: { from: string; to: string };
  receita_propria: { comissoes: number; contagem_depositos: number; nota: string };
  passivo_usuarios: { saldo_atual_carteiras: number; nota: string };
  volume_intermediado: {
    depositos_brutos: number;
    saques: number;
    apostas_realizadas: number;
    premios_pagos: number;
    reembolsos: number;
    nota: string;
  };
  resumo: { receita_declaravel: number; passivo_total: number; ratio_comissao_pct: number };
}

export default function RelatorioFinanceiro() {
  const [data, setData] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/relatorio-financeiro?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-white text-xs"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-white text-xs"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-black text-xs font-semibold rounded-lg disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          Gerar relatório
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Receita declarável */}
          <div className="bg-sim/5 border border-sim/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-sim" />
              <h3 className="text-sm font-bold text-white">Receita Própria (Declarável)</h3>
              <span className="text-xs bg-sim/20 text-sim px-2 py-0.5 rounded-full">Declara pra Receita Federal</span>
            </div>
            <p className="text-2xl font-bold text-sim">{formatCurrency(data.receita_propria.comissoes)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.receita_propria.contagem_depositos} depósitos · {data.resumo.ratio_comissao_pct}% do volume bruto
            </p>
            <p className="text-xs text-sim/70 mt-2 bg-sim/10 rounded-lg px-3 py-1.5">{data.receita_propria.nota}</p>
          </div>

          {/* Passivo usuários */}
          <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-yellow-400" />
              <h3 className="text-sm font-bold text-white">Passivo — Saldo dos Usuários</h3>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Não é sua receita</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{formatCurrency(data.passivo_usuarios.saldo_atual_carteiras)}</p>
            <p className="text-xs text-yellow-500/70 mt-2 bg-yellow-500/10 rounded-lg px-3 py-1.5">{data.passivo_usuarios.nota}</p>
          </div>

          {/* Volume intermediado */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-bold text-white">Volume Intermediado</h3>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Passa pela plataforma, não é receita</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Depósitos brutos", value: data.volume_intermediado.depositos_brutos },
                { label: "Saques realizados", value: data.volume_intermediado.saques },
                { label: "Volume apostado", value: data.volume_intermediado.apostas_realizadas },
                { label: "Prêmios pagos", value: data.volume_intermediado.premios_pagos },
                { label: "Reembolsos", value: data.volume_intermediado.reembolsos },
              ].map((item) => (
                <div key={item.label} className="bg-background/50 rounded-lg p-3">
                  <p className="text-lg font-bold text-white">{formatCurrency(item.value)}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 mt-3 bg-muted/20 rounded-lg px-3 py-1.5">{data.volume_intermediado.nota}</p>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/10 border border-border rounded-lg px-4 py-3 space-y-1">
            <p className="font-semibold text-white">Período: {data.periodo.from} → {data.periodo.to}</p>
            <p>Este relatório separa sua receita real (comissões) do volume custodiado (dinheiro dos usuários). Apresente apenas a linha &quot;Receita Própria&quot; ao contador para apuração de ISS, PIS e COFINS.</p>
          </div>
        </div>
      )}
    </div>
  );
}
