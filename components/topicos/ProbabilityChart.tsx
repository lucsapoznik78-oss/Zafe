"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, subDays, subWeeks, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Filter = "1D" | "1W" | "1M" | "ALL";

interface Snapshot {
  prob_sim: number;
  volume_sim: number;
  volume_nao: number;
  recorded_at: string;
}

interface Stats {
  prob_sim: number;
  volume_sim: number;
  volume_nao: number;
  total_volume: number;
}

interface OutcomeMeta {
  id: string;
  label: string;
}

// Ponto da série multi: { time, [outcomeId]: prob% }
type MultiPoint = { time: string } & Record<string, number | string>;

interface Props {
  topicId?: string;
  chartUrl?: string;
  marketType?: "binary" | "multi";
  initialSnapshots: Snapshot[];
  initialStats: Stats | null;
}

// Paleta para resultados (uma cor por linha).
const PALETTE = [
  "#86efac", "#f87171", "#60a5fa", "#fbbf24", "#c084fc",
  "#34d399", "#fb923c", "#f472b6", "#22d3ee", "#a3e635",
];

function formatXLabel(isoDate: string, filter: Filter) {
  const d = parseISO(isoDate);
  if (filter === "1D") return format(d, "HH:mm", { locale: ptBR });
  if (filter === "ALL") return format(d, "dd MMM", { locale: ptBR });
  return format(d, "dd/MM", { locale: ptBR });
}

function cutoffFor(filter: Filter) {
  const now = new Date();
  return filter === "1D" ? subDays(now, 1)
    : filter === "1W" ? subWeeks(now, 1)
    : filter === "1M" ? subMonths(now, 1)
    : new Date(0);
}

// Domínio do eixo Y com zoom automático: enquadra os valores e adiciona uma
// folga, em vez de fixar [0,100] (que achata variações pequenas em linhas retas).
function autoDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 100];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) { min -= 5; max += 5; } // série quase plana → abre um pouco
  const pad = Math.max((max - min) * 0.15, 1);
  return [Math.max(0, Math.floor(min - pad)), Math.min(100, Math.ceil(max + pad))];
}

// Corta o trecho inicial plano: se a série fica constante na maior parte do
// gráfico e só se move no final, mostra apenas a partir da mudança (mantendo
// 1 ponto plano como âncora), em vez de meses de linha reta.
function trimFlatStart<T>(points: T[], values: (p: T) => number[]): T[] {
  if (points.length < 3) return points;
  const first = values(points[0]);
  const EPS = 0.5; // pontos percentuais
  let firstMove = -1;
  for (let i = 1; i < points.length; i++) {
    const v = values(points[i]);
    if (v.some((x, j) => Math.abs(x - (first[j] ?? 0)) > EPS)) {
      firstMove = i;
      break;
    }
  }
  if (firstMove === -1) return points; // tudo plano → mantém como está
  if (firstMove / points.length < 0.6) return points; // parte plana não domina
  return points.slice(firstMove - 1);
}

// Após o trim, a janela visível pode cobrir pouco tempo — usa rótulos mais
// granulares (horário) quando o recorte cabe em ~1 dia e meio.
function effectiveFilter(times: string[], filter: Filter): Filter {
  if (times.length < 2) return filter;
  const span = parseISO(times[times.length - 1]).getTime() - parseISO(times[0]).getTime();
  return span <= 36 * 60 * 60 * 1000 ? "1D" : filter;
}

function buildBinaryData(snapshots: Snapshot[], stats: Stats | null, filter: Filter) {
  const cutoff = cutoffFor(filter);
  const filtered = snapshots.filter((s) => parseISO(s.recorded_at) >= cutoff);

  const points = filtered.map((s) => ({
    time: s.recorded_at,
    label: "",
    sim: parseFloat((s.prob_sim * 100).toFixed(1)),
    nao: parseFloat(((1 - s.prob_sim) * 100).toFixed(1)),
  }));

  if (stats && stats.volume_sim > 0 && stats.volume_nao > 0) {
    const liveProb = stats.prob_sim ?? 0.5;
    points.push({
      time: new Date().toISOString(),
      label: "Agora",
      sim: parseFloat((liveProb * 100).toFixed(1)),
      nao: parseFloat(((1 - liveProb) * 100).toFixed(1)),
    });
  }

  const trimmed = trimFlatStart(points, (p) => [p.sim]);
  const eff = effectiveFilter(trimmed.map((p) => p.time), filter);
  return trimmed.map((p) =>
    p.label === "Agora" ? p : { ...p, label: formatXLabel(p.time, eff) }
  );
}

function buildMultiData(points: MultiPoint[], outcomes: OutcomeMeta[], filter: Filter) {
  const cutoff = cutoffFor(filter);
  // Mantém o primeiro ponto (semente) como âncora mesmo fora da janela.
  const filtered = points.filter((p, i) => i === 0 || parseISO(p.time) >= cutoff);
  const trimmed = trimFlatStart(filtered, (p) => outcomes.map((o) => (p[o.id] as number) ?? 0));
  const eff = effectiveFilter(trimmed.map((p) => p.time), filter);
  return trimmed.map((p) => {
    const row: Record<string, number | string> = { label: formatXLabel(p.time, eff) };
    for (const o of outcomes) row[o.id] = p[o.id] as number;
    return row;
  });
}

function BinaryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      <p className="text-sim font-semibold">SIM: {payload[0]?.value?.toFixed(1)}%</p>
      <p className="text-nao font-semibold">NÃO: {payload[1]?.value?.toFixed(1)}%</p>
    </div>
  );
}

function MultiTooltip(outcomes: OutcomeMeta[], colors: Record<string, string>) {
  return function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
        <p className="text-muted-foreground mb-1">{label}</p>
        {sorted.map((entry: any) => {
          const meta = outcomes.find((o) => o.id === entry.dataKey);
          return (
            <p key={entry.dataKey} className="font-semibold flex items-center gap-1.5" style={{ color: colors[entry.dataKey] }}>
              <span className="w-2 h-2 rounded-full" style={{ background: colors[entry.dataKey] }} />
              {meta?.label ?? entry.dataKey}: {entry.value?.toFixed(1)}%
            </p>
          );
        })}
      </div>
    );
  };
}

function EndDot(color: string) {
  return function DotRenderer(props: any) {
    const { cx, cy, index, data } = props;
    if (index !== data?.length - 1) return null;
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={color} stroke="#000" strokeWidth={1.5} />
    );
  };
}

export default function ProbabilityChart({ topicId, chartUrl, marketType = "binary", initialSnapshots, initialStats }: Props) {
  const resolvedChartUrl = chartUrl ?? (topicId ? `/api/topicos/${topicId}/chart` : null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [mode, setMode] = useState<"binary" | "multi">(marketType);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots);
  const [stats, setStats] = useState<Stats | null>(initialStats);
  const [multiPoints, setMultiPoints] = useState<MultiPoint[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeMeta[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!resolvedChartUrl) return;
      const res = await fetch(resolvedChartUrl);
      if (!res.ok) return;
      const json = await res.json();
      if (json.marketType) setMode(json.marketType);
      if (json.marketType === "multi") {
        setMultiPoints(json.points ?? []);
        setOutcomes(json.outcomes ?? []);
      } else {
        if (json.snapshots) setSnapshots(json.snapshots);
        if (json.stats) setStats(json.stats);
      }
    } catch {}
  }, [resolvedChartUrl]);

  useEffect(() => {
    // Busca imediata (necessária p/ multi, cujos dados não vêm via props).
    refresh();
    intervalRef.current = setInterval(refresh, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh]);

  // ── Modo multi: 1 linha por resultado ────────────────────────────────────────
  if (mode === "multi") {
    const colors: Record<string, string> = {};
    outcomes.forEach((o, i) => { colors[o.id] = PALETTE[i % PALETTE.length]; });

    const data = buildMultiData(multiPoints, outcomes, filter);
    const hasData = data.length >= 2;
    const allValues = data.flatMap((d) => outcomes.map((o) => d[o.id] as number)).filter((v) => typeof v === "number");
    const domain = autoDomain(allValues);

    // Probabilidade atual por resultado (último ponto), ordem decrescente.
    const last = multiPoints.at(-1);
    const current = outcomes
      .map((o) => ({ ...o, prob: last ? (last[o.id] as number) : 0, color: colors[o.id] }))
      .sort((a, b) => b.prob - a.prob);

    return (
      <div className="space-y-3">
        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {current.map((o) => (
            <span key={o.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />
              <span className="text-muted-foreground">{o.label}</span>
              <span className="font-bold text-white">{o.prob.toFixed(1)}%</span>
            </span>
          ))}
        </div>

        {hasData ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={domain}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={MultiTooltip(outcomes, colors)} />
              {outcomes.map((o) => (
                <Line
                  key={o.id}
                  type="monotone"
                  dataKey={o.id}
                  stroke={colors[o.id]}
                  strokeWidth={2}
                  dot={EndDot(colors[o.id])}
                  activeDot={{ r: 4, fill: colors[o.id] }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Sem dados históricos ainda</p>
          </div>
        )}

        <div className="flex justify-end gap-1">
          {(["1D", "1W", "1M", "ALL"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-xs font-semibold transition-colors ${
                filter === f ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Modo binário: SIM/NÃO ────────────────────────────────────────────────────
  const data = buildBinaryData(snapshots, stats, filter);
  const hasBothSides = (stats?.volume_sim ?? 0) > 0 && (stats?.volume_nao ?? 0) > 0;
  const currentSim = hasBothSides
    ? (data.at(-1)?.sim ?? (stats ? (stats.prob_sim ?? 0.5) * 100 : 50))
    : null;
  const currentNao = hasBothSides ? (data.at(-1)?.nao ?? (currentSim != null ? 100 - currentSim : 50)) : null;
  const hasData = data.length >= 2;
  const domain = autoDomain(data.flatMap((d) => [d.sim, d.nao]));

  return (
    <div className="space-y-3">
      {/* Legenda */}
      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sim" />
          <span className="text-muted-foreground">SIM</span>
          <span className="font-bold text-white">
            {currentSim != null ? `${currentSim.toFixed(1)}%` : "—"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-nao" />
          <span className="text-muted-foreground">NÃO</span>
          <span className="font-bold text-white">
            {currentNao != null ? `${currentNao.toFixed(1)}%` : "—"}
          </span>
        </span>
      </div>

      {/* Gráfico */}
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<BinaryTooltip />} />
            {domain[0] <= 50 && domain[1] >= 50 && (
              <ReferenceLine y={50} stroke="#3f3f46" strokeDasharray="3 3" />
            )}
            <Line
              type="monotone"
              dataKey="sim"
              stroke="#86efac"
              strokeWidth={2}
              dot={EndDot("#86efac")}
              activeDot={{ r: 4, fill: "#86efac" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="nao"
              stroke="#f87171"
              strokeWidth={2}
              dot={EndDot("#f87171")}
              activeDot={{ r: 4, fill: "#f87171" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Sem dados históricos ainda</p>
        </div>
      )}

      {/* Filtros de tempo */}
      <div className="flex justify-end gap-1">
        {(["1D", "1W", "1M", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-primary text-black"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
