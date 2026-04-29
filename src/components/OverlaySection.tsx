"use client";

import { useState } from "react";
import { MetricChart } from "./MetricChart";
import { colorForEntity } from "@/lib/format";
import type { NamedSeries } from "@/lib/transforms";

interface Props {
  revenueBase: NamedSeries;
  viewsBase: NamedSeries;
  revenueOthers: NamedSeries[];
  viewsOthers: NamedSeries[];
  colors: Record<string, string>;
}

export function OverlaySection({
  revenueBase,
  viewsBase,
  revenueOthers,
  viewsOthers,
  colors,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const revenueSeries = [revenueBase, ...revenueOthers.filter((s) => checked.has(s.id))];
  const viewsSeries = [viewsBase, ...viewsOthers.filter((s) => checked.has(s.id))];

  return (
    <div className="flex flex-col gap-4">
      <MetricChart
        series={revenueSeries}
        metric="revenue"
        title="Receita dia a dia (USD)"
        colors={colors}
      />
      <MetricChart
        series={viewsSeries}
        metric="views"
        title="Views dia a dia"
        colors={colors}
      />

      {revenueOthers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">Sobrepor nos gráficos:</span>
          {revenueOthers.map((s) => {
            const color = colors[s.id] ?? colorForEntity(s.id, 0);
            return (
              <label
                key={s.id}
                className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={checked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 accent-indigo-600 dark:border-zinc-600"
                />
                <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: color }} />
                {s.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
