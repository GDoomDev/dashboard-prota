"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatUSD } from "@/lib/format";

export interface GoalChartPoint {
  date: string;
  label: string;
  actual: number | null;
  proj1: number;
  proj2: number;
  proj3: number;
}

interface Props {
  points: GoalChartPoint[];
  teamColor: string;
  todayDate: string;
  goalStart: string;
  goalEnd: string;
}

// Meta 1 lightest → Meta 3 most vivid (highest goal)
const META_COLORS = {
  1: "#86efac", // green-300
  2: "#4ade80", // green-400
  3: "#16a34a", // green-600
};

export function GoalProjectionChart({ points, teamColor, todayDate, goalStart, goalEnd }: Props) {
  const todayLabel = points.find((p) => p.date === todayDate)?.label ?? "";

  const step = Math.max(1, Math.floor(points.length / 8));
  const ticks = points
    .filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0)
    .map((p) => p.label);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Acumulado de receita vs. projeção de metas
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {fmtDate(goalStart)} → {fmtDate(goalEnd)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#d4d4d8" strokeOpacity={0.35} strokeWidth={0.75} />
          <XAxis
            dataKey="label"
            ticks={ticks}
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatUSD(v)}
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={100}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value, name) =>
              typeof value === "number"
                ? [formatUSD(value), String(name ?? "")]
                : ["—", String(name ?? "")]
            }
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid #e4e4e7",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ fontSize: 11, color: "#71717a", marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {todayLabel && (
            <ReferenceLine
              x={todayLabel}
              stroke="#a1a1aa"
              strokeDasharray="4 3"
              label={{ value: "Hoje", position: "insideTopRight", fontSize: 10, fill: "#a1a1aa" }}
            />
          )}
          <Line
            type="linear"
            dataKey="actual"
            name="Atual"
            stroke={teamColor}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="proj1"
            name="Meta 1"
            stroke={META_COLORS[1]}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="proj2"
            name="Meta 2"
            stroke={META_COLORS[2]}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="proj3"
            name="Meta 3"
            stroke={META_COLORS[3]}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${d}/${m}/${y}`;
}
