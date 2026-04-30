"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorFor, formatFullDate, formatInt, formatShortDate, formatUSD } from "@/lib/format";
import type { NamedSeries } from "@/lib/transforms";

type Metric = "revenue" | "views";

interface Props {
  series: NamedSeries[];
  metric: Metric;
  title: string;
  colors?: Record<string, string>;
}

interface ChartRow {
  date: string;
  [key: string]: number | string;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

function MetricTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  fmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div
      style={{
        backgroundColor: "rgb(24 24 27)",
        border: "1px solid rgb(63 63 70)",
        borderRadius: 8,
        color: "white",
        fontSize: 12,
        padding: "6px 10px",
      }}
    >
      <p style={{ marginBottom: 4, fontSize: 11, color: "#a1a1aa" }}>
        {formatFullDate(String(label ?? ""))}
      </p>
      {sorted.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 2 }}>
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function buildRows(series: NamedSeries[], metric: Metric): ChartRow[] {
  const dates = new Set<string>();
  for (const s of series) for (const r of s.rows) dates.add(r.date);
  return [...dates].sort().map((date) => {
    const row: ChartRow = { date };
    for (const s of series) {
      const r = s.rows.find((x) => x.date === date);
      row[s.id] = r ? r[metric] : 0;
    }
    return row;
  });
}

export function MetricChart({ series, metric, title, colors }: Props) {
  const fmt = metric === "revenue" ? formatUSD : formatInt;
  const data = buildRows(series, metric);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">{title}</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              stroke="currentColor"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) =>
                metric === "revenue" ? formatUSD(v).replace("US$ ", "$") : formatInt(v)
              }
              stroke="currentColor"
              fontSize={11}
              tickLine={false}
              width={70}
            />
            <Tooltip
              content={(props) => (
                <MetricTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipEntry[]}
                  label={props.label}
                  fmt={fmt}
                />
              )}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {series.map((s, i) => (
              <Line
                key={s.id}
                type="linear"
                dataKey={s.id}
                stroke={colors?.[s.id] ?? colorFor(i)}
                strokeWidth={2}
                dot={false}
                name={s.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
