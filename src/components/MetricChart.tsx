"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorFor, formatAxisUSD, formatFullDate, formatInt, formatShortDate, formatUSD } from "@/lib/format";
import type { NamedSeries } from "@/lib/transforms";

type Metric = "revenue" | "views";

const TOTAL_KEY = "__total__";

interface Props {
  series: NamedSeries[];
  metric: Metric;
  title: string;
  colors?: Record<string, string>;
  showTotal?: boolean;
}

interface ChartRow {
  date: string;
  [key: string]: number | string | null;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface LegendPayloadEntry {
  value: string;
  color: string;
  dataKey: string;
}

function MetricTooltip({
  active,
  payload,
  label,
  fmt,
  showTotal,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  fmt: (n: number) => string;
  showTotal?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const valid = [...payload].filter((e) => e.value != null);
  const totalEntry = valid.find((e) => e.name === "Total");
  const seriesEntries = valid.filter((e) => e.name !== "Total").sort((a, b) => b.value - a.value);

  // Show total even when the line is toggled off — compute from series entries as fallback
  const totalValue = totalEntry?.value ?? (showTotal ? seriesEntries.reduce((s, e) => s + e.value, 0) : null);
  const hasTotal = showTotal && totalValue != null;

  return (
    <div
      style={{
        backgroundColor: "rgb(24 24 27)",
        border: "1px solid rgb(63 63 70)",
        borderRadius: 8,
        color: "white",
        fontSize: 12,
        padding: "6px 10px",
        minWidth: 180,
      }}
    >
      <p style={{ marginBottom: hasTotal ? 6 : 4, fontSize: 11, color: "#a1a1aa" }}>
        {formatFullDate(String(label ?? ""))}
      </p>
      {hasTotal && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ color: "#a1a1aa", fontWeight: 600 }}>Total</span>
            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {fmt(totalValue!)}
            </span>
          </div>
          {seriesEntries.length > 0 && (
            <div style={{ borderTop: "1px solid rgb(63 63 70)", marginBottom: 6 }} />
          )}
        </>
      )}
      {seriesEntries.map((entry, i) => (
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

function ChartLegend({
  payload,
  showTotal,
  totalVisible,
  onTotalToggle,
}: {
  payload?: LegendPayloadEntry[];
  showTotal: boolean;
  totalVisible: boolean;
  onTotalToggle: () => void;
}) {
  const seriesItems = (payload ?? []).filter((p) => p.dataKey !== TOTAL_KEY);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "4px 16px",
        paddingTop: 8,
        fontSize: 12,
      }}
    >
      {seriesItems.map((item) => (
        <span key={item.dataKey} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="16" height="10" style={{ flexShrink: 0 }}>
            <line x1="0" y1="5" x2="16" y2="5" stroke={item.color} strokeWidth="2" />
          </svg>
          {item.value}
        </span>
      ))}
      {showTotal && (
        <label
          style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}
        >
          <svg width="16" height="10" style={{ flexShrink: 0 }}>
            <line
              x1="0" y1="5" x2="16" y2="5"
              stroke="#a1a1aa"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          </svg>
          Total
          <input
            type="checkbox"
            checked={totalVisible}
            onChange={onTotalToggle}
            style={{ cursor: "pointer", accentColor: "#a1a1aa" }}
          />
        </label>
      )}
    </div>
  );
}

/**
 * For revenue charts, finds the last date where total revenue across all series > 0.
 * If there are trailing dates after it with total = 0, those are "incomplete" pending days.
 */
function findIncompleteAfter(series: NamedSeries[], metric: Metric): string | undefined {
  if (metric !== "revenue") return undefined;
  const allDates = [...new Set(series.flatMap((s) => s.rows.map((r) => r.date)))].sort();
  if (allDates.length === 0) return undefined;
  let lastRevenueDate: string | undefined;
  for (const date of allDates) {
    let total = 0;
    for (const s of series) {
      const r = s.rows.find((x) => x.date === date);
      total += r ? r.revenue : 0;
    }
    if (total > 0) lastRevenueDate = date;
  }
  const lastDate = allDates[allDates.length - 1];
  return lastRevenueDate && lastDate > lastRevenueDate ? lastRevenueDate : undefined;
}

function buildRows(
  series: NamedSeries[],
  metric: Metric,
  showTotal: boolean,
  incompleteAfter?: string,
): ChartRow[] {
  const dates = new Set<string>();
  for (const s of series) for (const r of s.rows) dates.add(r.date);
  return [...dates].sort().map((date) => {
    const pending = incompleteAfter !== undefined && date > incompleteAfter;
    const row: ChartRow = { date };
    let total = 0;
    for (const s of series) {
      const r = s.rows.find((x) => x.date === date);
      const val = r ? r[metric] : 0;
      row[s.id] = pending ? null : val;
      if (!pending) total += val;
    }
    if (showTotal) row[TOTAL_KEY] = pending ? null : total;
    return row;
  });
}

export function MetricChart({ series, metric, title, colors, showTotal }: Props) {
  const fmt = metric === "revenue" ? formatUSD : formatInt;
  const incompleteAfter = findIncompleteAfter(series, metric);
  const data = buildRows(series, metric, !!showTotal, incompleteAfter);
  const [totalVisible, setTotalVisible] = useState(true);

  const incompleteStart = incompleteAfter
    ? (data.find((row) => (row.date as string) > incompleteAfter)?.date as string | undefined)
    : undefined;
  const incompleteEnd = incompleteStart ? (data[data.length - 1]?.date as string) : undefined;

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
                metric === "revenue" ? formatAxisUSD(v) : formatInt(v)
              }
              stroke="currentColor"
              fontSize={11}
              tickLine={false}
              width={88}
            />
            <Tooltip
              content={(props) => (
                <MetricTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipEntry[]}
                  label={props.label}
                  fmt={fmt}
                  showTotal={!!showTotal}
                />
              )}
            />
            <Legend
              content={(legendProps) => (
                <ChartLegend
                  payload={legendProps.payload as unknown as LegendPayloadEntry[]}
                  showTotal={!!showTotal}
                  totalVisible={totalVisible}
                  onTotalToggle={() => setTotalVisible((v) => !v)}
                />
              )}
            />
            {incompleteStart && incompleteEnd && (
              <ReferenceArea
                x1={incompleteStart}
                x2={incompleteEnd}
                fill="rgba(161,161,170,0.12)"
                stroke="rgba(161,161,170,0.3)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            )}
            {series.map((s, i) => (
              <Line
                key={s.id}
                type="linear"
                dataKey={s.id}
                stroke={colors?.[s.id] ?? colorFor(i)}
                strokeWidth={2}
                dot={false}
                name={s.label}
                connectNulls={false}
              />
            ))}
            {showTotal && totalVisible && (
              <Line
                key={TOTAL_KEY}
                type="linear"
                dataKey={TOTAL_KEY}
                stroke="#a1a1aa"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name="Total"
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
