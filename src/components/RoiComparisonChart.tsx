"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUSD } from "@/lib/format";

export interface RoiBarData {
  name: string;
  custoOp: number;
  custoGestao: number;
  faturamento: number;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload?: RoiBarData;
}

function RoiTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const faturamento = payload[0]?.payload?.faturamento ?? 0;
  const sorted = [...payload].filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div
      style={{
        backgroundColor: "rgb(24 24 27)",
        border: "1px solid rgb(63 63 70)",
        borderRadius: 8,
        color: "white",
        fontSize: 12,
        minWidth: 180,
        overflow: "hidden",
      }}
    >
      {sorted.map((entry, i) => {
        const isFat = entry.dataKey === "faturamento";
        const pct = faturamento > 0 && !isFat ? (entry.value / faturamento) * 100 : null;
        return (
          <div
            key={i}
            style={{
              padding: "7px 12px",
              borderTop: i > 0 ? "1px solid rgb(63 63 70)" : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: entry.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#a1a1aa", fontSize: 11 }}>{entry.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingLeft: 14 }}>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {formatUSD(entry.value)}
              </span>
              {pct !== null && (
                <span style={{ color: "#a1a1aa", fontSize: 11 }}>
                  {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do fat.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  data: RoiBarData[];
  title: string;
  subtitle?: string;
}

export function RoiComparisonChart({ data, title, subtitle }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">{title}</p>
        {subtitle && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        )}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
            <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => formatUSD(v).replace("US$ ", "$")}
              stroke="currentColor"
              fontSize={11}
              tickLine={false}
              width={74}
            />
            <Tooltip
              content={(props) => (
                <RoiTooltip
                  active={props.active}
                  payload={props.payload as unknown as TooltipEntry[]}
                />
              )}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {/* Custo operacional + custo gestão empilhados */}
            <Bar dataKey="custoOp" name="Custo Op." stackId="custo" fill="#ef4444" radius={[0, 0, 0, 0]} />
            <Bar dataKey="custoGestao" name="Custo Gestão" stackId="custo" fill="#f97316" radius={[4, 4, 0, 0]} />
            {/* Faturamento — barra separada, não empilhada */}
            <Bar dataKey="faturamento" name="Faturamento" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
