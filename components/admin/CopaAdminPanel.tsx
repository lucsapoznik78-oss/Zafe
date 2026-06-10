"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PlayCircle,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import type { CopaCompetition, CopaMatch, CopaStage } from "@/lib/copa/types";
import { isKnockout } from "@/lib/copa/types";

interface ResolutionLog {
  id: string;
  match_id: string;
  attempt: number;
  model: string | null;
  raw_response: string | null;
  parsed: unknown;
  confidence: number | null;
  source_url: string | null;
  outcome: string;
  created_at: string;
}

interface Props {
  competition: CopaCompetition;
  matches: CopaMatch[];
  participants: number;
  reviewLogs: ResolutionLog[];
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

const STATUS_LABEL: Record<CopaMatch["status"], string> = {
  scheduled: "Agendada",
  postponed: "Adiada",
  under_review: "Revisão",
  finished: "Finalizada",
  void: "Anulada",
};

const STATUS_BADGE: Record<CopaMatch["status"], string> = {
  scheduled: "bg-muted text-muted-foreground",
  postponed: "bg-yellow-500/20 text-yellow-400",
  under_review: "bg-orange-500/20 text-orange-400",
  finished: "bg-sim/20 text-sim",
  void: "bg-nao/20 text-nao",
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

export default function CopaAdminPanel({ competition, matches, participants, reviewLogs }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  const underReview = matches.filter((m) => m.status === "under_review");
  const pendingCount = matches.filter((m) => m.status !== "finished" && m.status !== "void").length;

  const visible = useMemo(
    () => (statusFilter === "all" ? matches : matches.filter((m) => m.status === statusFilter)),
    [matches, statusFilter]
  );

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy size={18} className="text-primary" /> {competition.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Status: <span className="text-white">{competition.status}</span>
            {competition.pot_paid_at && (
              <span className="ml-2 text-sim">· premiação paga em {fmtKickoff(competition.pot_paid_at)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => call("resolver", "/api/cron/copa-resolver")}
            disabled={!!busy}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-black font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy === "resolver" ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Resolver agora
          </button>
          {competition.status !== "paid" && competition.status !== "cancelled" && (
            <button
              onClick={() => setConfirmFinalize(true)}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border text-white font-semibold text-sm rounded-lg hover:border-primary disabled:opacity-50 transition-colors"
            >
              <Trophy size={14} className="text-yellow-400" /> Finalizar e premiar
            </button>
          )}
        </div>
      </header>

      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.kind === "ok" ? "border-sim/30 bg-sim/10 text-sim" : "border-nao/30 bg-nao/10 text-nao"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Confirmação de payout */}
      {confirmFinalize && (
        <div className="bg-card border border-yellow-500/40 rounded-xl p-4 space-y-3">
          <p className="text-sm text-white font-semibold flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400" /> Confirmar encerramento da Zafe Copa?
          </p>
          <p className="text-xs text-muted-foreground">
            Todas as partidas precisam estar finalizadas ou anuladas ({pendingCount} pendente{pendingCount === 1 ? "" : "s"}).
            O pote de <span className="text-white font-mono">Z$ {Number(competition.pot_total).toLocaleString("pt-BR")}</span>{" "}
            será creditado ao 1º colocado do ranking. Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const ok = await call("finalizar", "/api/admin/copa/finalizar");
                if (ok) setConfirmFinalize(false);
              }}
              disabled={!!busy}
              className="px-3 py-2 bg-yellow-500 text-black font-bold text-sm rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
              {busy === "finalizar" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirmar e pagar premiação"}
            </button>
            <button
              onClick={() => setConfirmFinalize(false)}
              className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Trophy size={14} className="text-primary" />} label="Pote" value={`Z$ ${Number(competition.pot_total).toLocaleString("pt-BR")}`} />
        <StatCard icon={<Users size={14} className="text-primary" />} label="Participantes" value={String(participants)} />
        <StatCard icon={<CheckCircle2 size={14} className="text-sim" />} label="Finalizadas" value={`${matches.filter((m) => m.status === "finished").length}/${matches.length}`} />
        <StatCard icon={<AlertTriangle size={14} className="text-orange-400" />} label="Em revisão" value={String(underReview.length)} />
      </div>

      {/* Fila de revisão manual */}
      {underReview.length > 0 && (
        <section className="bg-card border border-orange-500/30 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-400" />
            Revisão manual
            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">{underReview.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            O oráculo não chegou a um veredito confiável. Informe o resultado oficial abaixo (placar ao fim do jogo,
            incluindo prorrogação, sem pênaltis).
          </p>
          {underReview.map((m) => (
            <div key={m.id} className="border border-border rounded-lg p-4 space-y-3 bg-orange-500/5">
              <MatchHeading match={m} />
              <ResultForm match={m} busy={busy} onSubmit={call} />
              <LogList logs={reviewLogs.filter((l) => l.match_id === m.id)} />
            </div>
          ))}
        </section>
      )}

      {/* Tabela de partidas */}
      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Partidas</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="all">Todas ({matches.length})</option>
            {(["scheduled", "postponed", "under_review", "finished", "void"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]} ({matches.filter((m) => m.status === s).length})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {visible.map((m) => {
            const open = openMatch === m.id;
            return (
              <div key={m.id} className="border border-border rounded-lg">
                <button
                  onClick={() => setOpenMatch(open ? null : m.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">#{m.match_number}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {STAGE_LABEL[m.stage]}
                    {m.group_name ? ` ${m.group_name}` : ""}
                  </span>
                  <span className="text-sm text-white flex-1 truncate">
                    {teamLabel(m, "home")} <span className="text-muted-foreground">vs</span> {teamLabel(m, "away")}
                    {m.status === "finished" && m.home_goals != null && (
                      <span className="ml-2 font-mono text-sim">
                        {m.home_goals}–{m.away_goals}
                        {m.went_to_pens ? " (pên.)" : m.went_to_et ? " (prorr.)" : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{fmtKickoff(m.kickoff_at)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border px-3 py-3 space-y-4">
                    {!m.home_team || !m.away_team ? (
                      <SlotForm match={m} busy={busy} onSubmit={call} />
                    ) : (
                      m.status !== "void" && <ResultForm match={m} busy={busy} onSubmit={call} />
                    )}
                    {m.status !== "finished" && m.status !== "void" && (
                      <PostponeForm match={m} busy={busy} onSubmit={call} />
                    )}
                    {m.status !== "void" && <VoidButton match={m} busy={busy} onSubmit={call} />}
                    <LogList logs={reviewLogs.filter((l) => l.match_id === m.id)} />
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma partida neste filtro.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function MatchHeading({ match: m }: { match: CopaMatch }) {
  return (
    <p className="text-sm font-semibold text-white">
      <span className="text-muted-foreground font-mono mr-2">#{m.match_number}</span>
      {teamLabel(m, "home")} vs {teamLabel(m, "away")}
      <span className="ml-2 text-xs text-muted-foreground font-normal">{fmtKickoff(m.kickoff_at)}</span>
    </p>
  );
}

type CallFn = (key: string, url: string, init?: RequestInit) => Promise<boolean>;

function ResultForm({ match: m, busy, onSubmit }: { match: CopaMatch; busy: string | null; onSubmit: CallFn }) {
  const ko = isKnockout(m.stage);
  const [homeGoals, setHomeGoals] = useState(m.home_goals != null ? String(m.home_goals) : "");
  const [awayGoals, setAwayGoals] = useState(m.away_goals != null ? String(m.away_goals) : "");
  const [wentToEt, setWentToEt] = useState(m.went_to_et ?? false);
  const [wentToPens, setWentToPens] = useState(m.went_to_pens ?? false);
  const [advanced, setAdvanced] = useState<string>(m.advanced_side ?? "");
  const [sourceUrl, setSourceUrl] = useState(m.source_url ?? "");
  const key = `resultado-${m.id}`;
  const isCorrection = m.status === "finished";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white">
        {isCorrection ? "Corrigir resultado" : "Resultado manual"}
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
        onClick={() =>
          onSubmit(key, `/api/admin/copa/partidas/${m.id}/resultado`, {
            body: JSON.stringify({
              home_goals: Number(homeGoals),
              away_goals: Number(awayGoals),
              went_to_et: ko ? wentToEt : false,
              went_to_pens: ko ? wentToPens : false,
              advanced_side: ko && advanced ? advanced : null,
              source_url: sourceUrl || null,
            }),
          })
        }
        disabled={!!busy || homeGoals === "" || awayGoals === "" || (ko && !advanced)}
        className="px-3 py-1.5 bg-primary text-black font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {busy === key ? <Loader2 size={12} className="animate-spin mx-auto" /> : isCorrection ? "Corrigir e recomputar pontos" : "Aplicar resultado"}
      </button>
    </div>
  );
}

function SlotForm({ match: m, busy, onSubmit }: { match: CopaMatch; busy: string | null; onSubmit: CallFn }) {
  const [home, setHome] = useState(m.home_team ?? "");
  const [away, setAway] = useState(m.away_team ?? "");
  const key = `slot-${m.id}`;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white">
        Preencher times do slot{" "}
        <span className="text-muted-foreground font-normal">
          ({m.home_placeholder ?? "?"} vs {m.away_placeholder ?? "?"})
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={home} onChange={(e) => setHome(e.target.value)} placeholder="Mandante"
          className="flex-1 min-w-[120px] bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
        />
        <span className="text-muted-foreground text-sm">vs</span>
        <input
          value={away} onChange={(e) => setAway(e.target.value)} placeholder="Visitante"
          className="flex-1 min-w-[120px] bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
        />
        <button
          onClick={() =>
            onSubmit(key, `/api/admin/copa/partidas/${m.id}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "fill_slot", home_team: home.trim(), away_team: away.trim() }),
            })
          }
          disabled={!!busy || home.trim().length < 2 || away.trim().length < 2}
          className="px-3 py-1.5 bg-primary text-black font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy === key ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Salvar times"}
        </button>
      </div>
    </div>
  );
}

function PostponeForm({ match: m, busy, onSubmit }: { match: CopaMatch; busy: string | null; onSubmit: CallFn }) {
  const [when, setWhen] = useState("");
  const key = `postpone-${m.id}`;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
        <CalendarClock size={12} className="text-yellow-400" /> Adiar partida
        <span className="text-muted-foreground font-normal">(palpites mantidos; horário local)</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
          className="bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
        />
        <button
          onClick={() =>
            onSubmit(key, `/api/admin/copa/partidas/${m.id}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "postpone", kickoff_at: new Date(when).toISOString() }),
            })
          }
          disabled={!!busy || !when}
          className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 font-bold text-xs rounded-lg hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
        >
          {busy === key ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Adiar"}
        </button>
      </div>
    </div>
  );
}

function VoidButton({ match: m, busy, onSubmit }: { match: CopaMatch; busy: string | null; onSubmit: CallFn }) {
  const [confirming, setConfirming] = useState(false);
  const key = `void-${m.id}`;
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-nao/10 text-nao font-semibold text-xs rounded-lg hover:bg-nao/20 disabled:opacity-50 transition-colors"
      >
        <XCircle size={12} /> Anular partida
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-nao">Anular remove qualquer pontuação desta partida. Confirmar?</span>
      <button
        onClick={async () => {
          const ok = await onSubmit(key, `/api/admin/copa/partidas/${m.id}`, {
            method: "PATCH",
            body: JSON.stringify({ action: "void" }),
          });
          if (ok) setConfirming(false);
        }}
        disabled={!!busy}
        className="px-3 py-1.5 bg-nao text-black font-bold text-xs rounded-lg hover:bg-nao/90 disabled:opacity-50 transition-colors"
      >
        {busy === key ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Sim, anular"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="px-3 py-1.5 bg-muted text-muted-foreground text-xs rounded-lg hover:text-white transition-colors"
      >
        Voltar
      </button>
    </div>
  );
}

function LogList({ logs }: { logs: ResolutionLog[] }) {
  const [open, setOpen] = useState(false);
  if (logs.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-white transition-colors"
      >
        {open ? "Ocultar" : "Mostrar"} log do oráculo ({logs.length})
      </button>
      {open &&
        logs.map((l) => (
          <div key={l.id} className="bg-input border border-border rounded-lg p-2 text-xs space-y-1">
            <p className="text-muted-foreground">
              <span className="text-white">{l.outcome}</span>
              {l.model && <span className="ml-2 font-mono">{l.model}</span>}
              {l.confidence != null && <span className="ml-2">conf. {l.confidence}</span>}
              <span className="ml-2">{new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            </p>
            {l.source_url && (
              <p className="text-muted-foreground break-all">fonte: {l.source_url}</p>
            )}
            {l.raw_response && (
              <pre className="whitespace-pre-wrap break-all text-muted-foreground max-h-40 overflow-y-auto">
                {l.raw_response}
              </pre>
            )}
          </div>
        ))}
    </div>
  );
}
