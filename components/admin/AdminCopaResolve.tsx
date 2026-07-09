"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, Trophy, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { CopaMatch, CopaStage } from "@/lib/copa/types";
import { isKnockout } from "@/lib/copa/types";

interface Props {
  matches: CopaMatch[];
}

const STAGE_LABEL: Record<CopaStage, string> = {
  group: "Grupos",
  r32: "32 avos",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semi",
  third: "3º lugar",
  final: "Final",
};

function teamLabel(m: CopaMatch, side: "home" | "away") {
  return side === "home"
    ? m.home_team ?? m.home_placeholder ?? "?"
    : m.away_team ?? m.away_placeholder ?? "?";
}

function fmtKickoff(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminCopaResolve({ matches }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function call(key: string, url: string, init?: RequestInit) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "error", text: data.error ?? `Erro (${res.status})` });
        return false;
      }
      setMsg({ kind: "ok", text: "Operação concluída." });
      router.refresh();
      return true;
    } catch {
      setMsg({ kind: "error", text: "Falha de rede" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const pending = matches.filter((m) => !done.has(m.id));

  return (
    <div className="bg-card border border-yellow-500/30 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          Copa — Partidas Aguardando Resolução
          {pending.length > 0 && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{pending.length}</span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => call("resolver", "/api/cron/copa-resolver")}
            disabled={!!busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy === "resolver" ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
            Resolver agora
          </button>
          <Link
            href="/admin/copa"
            className="px-3 py-1.5 bg-muted text-muted-foreground text-xs rounded-lg hover:text-white transition-colors"
          >
            Painel completo
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Oracle resolve automaticamente. Partidas já disputadas que ele não conseguiu fechar aparecem aqui para resolução
        manual — informe o placar (ao fim da prorrogação, sem pênaltis) e os pontos são distribuídos.
      </p>

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm mb-3 ${
            msg.kind === "ok" ? "border-sim/30 bg-sim/10 text-sim" : "border-nao/30 bg-nao/10 text-nao"
          }`}
        >
          {msg.text}
        </div>
      )}

      {pending.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">
          Nenhuma partida pendente — tudo resolvido.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map((m) => (
            <div key={m.id} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-white">
                <span className="text-muted-foreground font-mono mr-2">#{m.match_number}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground mr-2">
                  {STAGE_LABEL[m.stage]}
                  {m.group_name ? ` ${m.group_name}` : ""}
                </span>
                {teamLabel(m, "home")} <span className="text-muted-foreground">vs</span> {teamLabel(m, "away")}
                <span className="ml-2 text-xs text-muted-foreground font-normal">{fmtKickoff(m.kickoff_at)}</span>
              </p>
              <ResultForm match={m} busy={busy} onSubmit={call} onDone={() => setDone((d) => new Set([...d, m.id]))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CallFn = (key: string, url: string, init?: RequestInit) => Promise<boolean>;

function ResultForm({
  match: m,
  busy,
  onSubmit,
  onDone,
}: {
  match: CopaMatch;
  busy: string | null;
  onSubmit: CallFn;
  onDone: () => void;
}) {
  const ko = isKnockout(m.stage);
  const [homeGoals, setHomeGoals] = useState(m.home_goals != null ? String(m.home_goals) : "");
  const [awayGoals, setAwayGoals] = useState(m.away_goals != null ? String(m.away_goals) : "");
  const [wentToEt, setWentToEt] = useState(m.went_to_et ?? false);
  const [wentToPens, setWentToPens] = useState(m.went_to_pens ?? false);
  const [advanced, setAdvanced] = useState<string>(m.advanced_side ?? "");
  const [sourceUrl, setSourceUrl] = useState(m.source_url ?? "");
  const key = `resultado-${m.id}`;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white">
        Resultado manual
        {ko && <span className="text-muted-foreground font-normal"> · placar ao fim da prorrogação, sem pênaltis</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" min={0} max={20} value={homeGoals} onChange={(e) => setHomeGoals(e.target.value)}
          placeholder={teamLabel(m, "home")}
          className="w-20 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
        />
        <span className="text-muted-foreground text-sm">×</span>
        <input
          type="number" min={0} max={20} value={awayGoals} onChange={(e) => setAwayGoals(e.target.value)}
          placeholder={teamLabel(m, "away")}
          className="w-20 bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
        />
        {ko && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={wentToEt} onChange={(e) => { setWentToEt(e.target.checked); if (!e.target.checked) setWentToPens(false); }} />
              Prorrogação
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={wentToPens} onChange={(e) => { setWentToPens(e.target.checked); if (e.target.checked) setWentToEt(true); }} />
              Pênaltis
            </label>
            <select
              value={advanced} onChange={(e) => setAdvanced(e.target.value)}
              className="bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="">Classificado…</option>
              <option value="home">{teamLabel(m, "home")}</option>
              <option value="away">{teamLabel(m, "away")}</option>
            </select>
          </>
        )}
      </div>
      <input
        type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="URL da fonte (opcional)"
        className="w-full bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
      />
      <button
        onClick={async () => {
          const ok = await onSubmit(key, `/api/admin/copa/partidas/${m.id}/resultado`, {
            body: JSON.stringify({
              home_goals: Number(homeGoals),
              away_goals: Number(awayGoals),
              went_to_et: ko ? wentToEt : false,
              went_to_pens: ko ? wentToPens : false,
              advanced_side: ko && advanced ? advanced : null,
              source_url: sourceUrl || null,
            }),
          });
          if (ok) onDone();
        }}
        disabled={!!busy || homeGoals === "" || awayGoals === "" || (ko && !advanced)}
        className="px-3 py-1.5 bg-primary text-white font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {busy === key ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Aplicar e distribuir pontos"}
      </button>
    </div>
  );
}
