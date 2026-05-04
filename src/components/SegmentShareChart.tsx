"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { colorForEntity, formatUSD } from "@/lib/format";

export interface TeamShare {
  team: string;
  revenue: number;
}

interface ShareDonutProps {
  title: string;
  data: TeamShare[];
}

function ShareDonut({ title, data }: ShareDonutProps) {
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, d) => s + d.revenue, 0);
  const colors = Object.fromEntries(sorted.map((d, i) => [d.team, colorForEntity(d.team, i)]));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={sorted}
            dataKey="revenue"
            nameKey="team"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
          >
            {sorted.map((entry, i) => (
              <Cell key={entry.team} fill={colors[entry.team] ?? colorForEntity(entry.team, i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : 0;
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
              return [`${pct}% · ${formatUSD(v)}`, String(name)];
            }}
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid #e4e4e7",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend ranked by revenue desc */}
      <div className="mt-3 flex flex-col gap-1.5 text-xs">
        {sorted.map((d, i) => {
          const pct = total > 0 ? (d.revenue / total) * 100 : 0;
          return (
            <div key={d.team} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ background: colors[d.team] ?? colorForEntity(d.team, i) }}
                />
                <span className="text-zinc-600 dark:text-zinc-400">{d.team}</span>
              </div>
              <div className="flex items-center gap-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-400 dark:text-zinc-500">{pct.toFixed(1)}%</span>
                <span className="font-medium">{formatUSD(d.revenue)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  shorts: TeamShare[];
  longos: TeamShare[];
}

export function SegmentShareChart({ shorts, longos }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ShareDonut title="Shorts — Participação por Time" data={shorts} />
      <ShareDonut title="Longos — Participação por Time" data={longos} />
    </div>
  );
}
