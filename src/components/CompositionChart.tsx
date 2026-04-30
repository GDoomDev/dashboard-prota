"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { colorForEntity, formatUSD, formatInt } from "@/lib/format";

interface Slice {
  id: string;
  label: string;
  value: number;
}

interface Props {
  // Revenue (required)
  byType: Slice[];
  byChannel?: Slice[];
  // Views (optional — when provided, a second row of charts is shown)
  byTypeViews?: Slice[];
  byChannelViews?: Slice[];
}

const KIND_COLORS: Record<string, string> = {
  longos: "#4f46e5",
  curtos: "#06b6d4",
};

function DonutChart({
  data,
  colors,
  title,
  formatValue = formatUSD,
}: {
  data: Slice[];
  colors: Record<string, string>;
  title: string;
  formatValue?: (n: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.id} fill={colors[entry.id] ?? colorForEntity(entry.id, i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : 0;
              const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
              return [`${pct}% · ${formatValue(v)}`, String(name)];
            }}
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid #e4e4e7",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1 text-xs">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: colors[d.id] ?? colorForEntity(d.id, i) }}
                />
                <span className="text-zinc-600 dark:text-zinc-400">{d.label}</span>
              </div>
              <div className="flex gap-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                <span>{pct.toFixed(1)}%</span>
                <span className="font-medium">{formatValue(d.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}

export function CompositionChart({ byType, byChannel, byTypeViews, byChannelViews }: Props) {
  const channelColors: Record<string, string> = Object.fromEntries(
    (byChannel ?? []).map((d, i) => [d.id, colorForEntity(d.id, i)]),
  );

  const hasViews = !!byTypeViews;

  return (
    <div className="flex flex-col gap-4">
      {/* Revenue row */}
      {hasViews && (
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Receita
        </p>
      )}
      <div className={`grid grid-cols-1 gap-4 ${byChannel ? "sm:grid-cols-2" : ""}`}>
        <Card>
          <DonutChart
            data={byType}
            colors={KIND_COLORS}
            title="Por tipo de conteúdo"
            formatValue={formatUSD}
          />
        </Card>
        {byChannel && (
          <Card>
            <DonutChart
              data={byChannel}
              colors={channelColors}
              title="Por canal"
              formatValue={formatUSD}
            />
          </Card>
        )}
      </div>

      {/* Views row */}
      {hasViews && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Views
          </p>
          <div className={`grid grid-cols-1 gap-4 ${byChannelViews ? "sm:grid-cols-2" : ""}`}>
            <Card>
              <DonutChart
                data={byTypeViews!}
                colors={KIND_COLORS}
                title="Por tipo de conteúdo"
                formatValue={formatInt}
              />
            </Card>
            {byChannelViews && (
              <Card>
                <DonutChart
                  data={byChannelViews}
                  colors={channelColors}
                  title="Por canal"
                  formatValue={formatInt}
                />
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
