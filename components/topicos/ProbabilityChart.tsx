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

interface Props {
  topicId: string;
  initialSnapshots: Snapshot[];
  initialStats: Stats | null;
}

function formatXLabel(isoDate: string, filter: Filter) {
  const d = parseISO(isoDate);
  if (filter === "1D") return format(d, "HH:mm", { locale: ptBR });
  if (filter === "ALL") return format(d, "dd MMM", { locale: ptBR });
  return format(d, "dd/MM", { locale: ptBR });
}

function buildChartData(snapshots: Snapshot[], stats: Stats | null, filter: Filter) {
  const now = new Date();
  const cutoff =
    filter === "1D" ? subDays(now, 1)
    : filter === "1W" ? subWeeks(now, 1)
    : filter === "1M" ? subMonths(now, 1)
    : new Date(0);

  const filtered = snapshots.filter((s) => parseISO(s.recorded_at) >= cutoff);

  const points = filtered.map((s) => ({
    time: s.recorded_at,
    label: formatXLabel(s.recorded_at, filter),
    sim: parseFloat((s.prob_sim * 100).toFixed(1)),
    nao: parseFloat(((1 - s.prob_sim) * 100).toFixed(1)),
  }));

  // Ponto ao vivo no final — só quando ambos os lados têm apostas
  if (stats && stats.volume_sim > 0 && stats.volume_nao > 0) {
    const liveProb = stats.prob_sim ?? 0.5;
    points.push({
      time: now.toISOString(),
      label: "Agora",
      sim: parseFloat((liveProb * 100).toFixed(1)),
      nao: parseFloat(((1 - liveProb) * 100).toFixed(1)),
    });
  }

  return points;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1.5">{label}</p>
      <p className="text-sim font-semibold">SIM: {payload[0]?.value?.toFixed(1)}%</p>
      <p className="text-nao font-semibold">NÃO: {payload[1]?.value?.toFixed(1)}%</p>
    </div>
  );
}

// Dot only on last data point
function EndDot(color: string) {
  return function DotRenderer(props: any) {
    const { cx, cy, index, data } = props;
    if (index !== data?.length - 1) return null;
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={color} stroke="#000" strokeWidth={1.5} />
    );
  };
}

export default function ProbabilityChart({ topicId, initialSnapshots, initialStats }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots);
  const [stats, setStats] = useState<Stats | null>(initialStats);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/topicos/${topicId}/chart`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.snapshots) setSnapshots(json.snapshots);
      if (json.stats) setStats(json.stats);
    } catch {}
  }, [topicId]);

  useEffect(() => {
    intervalRef.current = setInterval(refresh, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh]);

  const data = buildChartData(snapshots, stats, filter);
  const hasBothSides = (stats?.volume_sim ?? 0) > 0 && (stats?.volume_nao ?? 0) > 0;
  const currentSim = hasBothSides
    ? (data.at(-1)?.sim ?? (stats ? (stats.prob_sim ?? 0.5) * 100 : 50))
    : null;
  const currentNao = hasBothSides ? (data.at(-1)?.nao ?? (currentSim != null ? 100 - currentSim : 50)) : null;
  const hasData = data.length >= 2;

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
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#27272a"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#52525b" }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="#3f3f46" strokeDasharray="3 3" />
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
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
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
