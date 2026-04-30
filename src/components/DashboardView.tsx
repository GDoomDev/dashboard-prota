import { Suspense } from "react";
import { PeriodPicker } from "./PeriodPicker";
import { EntityPicker } from "./EntityPicker";
import { MetricChart } from "./MetricChart";
import { OverlaySection } from "./OverlaySection";
import { StatCard } from "./StatCard";
import { filterRows, NamedSeries, sumByDate, totals } from "@/lib/transforms";
import { DateRange } from "@/lib/transforms";
import { colorForEntity, formatInt, formatUSD, formatUSDPrecise } from "@/lib/format";

interface Props {
  title: string;
  description: string;
  series: NamedSeries[];
  range: DateRange;
  revenueEnd: string;
  selectedEntity?: string;
  entityLabel: string;
  emptyMessage?: string;
  rangeAvailable: boolean;
  defaultPreset?: "7d" | "30d" | "90d" | "tri" | "2026";
}

export function DashboardView({
  title,
  description,
  series,
  range,
  revenueEnd,
  selectedEntity,
  entityLabel,
  emptyMessage = "Sem dados no período selecionado.",
  rangeAvailable,
  defaultPreset,
}: Props) {
  const colorMap: Record<string, string> = Object.fromEntries(
    series.map((s, i) => [s.id, colorForEntity(s.id, i)]),
  );

  // Revenue series: capped at revenueEnd (excludes trailing zero-revenue day)
  const filteredRevenue: NamedSeries[] = series.map((s) => ({
    ...s,
    rows: filterRows(s.rows, { start: range.start, end: revenueEnd || range.end }),
  }));

  // Views series: full range (includes the extra day that may have 0 revenue but real views)
  const filteredViews: NamedSeries[] = series.map((s) => ({
    ...s,
    rows: filterRows(s.rows, range),
  }));

  // Narrow to selected entity for StatCard totals
  const displayedRevenue = selectedEntity
    ? filteredRevenue.filter((s) => s.id === selectedEntity)
    : filteredRevenue;
  const displayedViews = selectedEntity
    ? filteredViews.filter((s) => s.id === selectedEntity)
    : filteredViews;

  const { revenue } = totals(sumByDate(displayedRevenue.map((s) => s.rows)));
  const { views } = totals(sumByDate(displayedViews.map((s) => s.rows)));
  const rpm = views > 0 ? (revenue / views) * 1000 : 0;

  const hasData = rangeAvailable && (revenue > 0 || views > 0);

  // For single-entity view: split base from others
  const revenueBase = selectedEntity ? filteredRevenue.find((s) => s.id === selectedEntity) : null;
  const viewsBase = selectedEntity ? filteredViews.find((s) => s.id === selectedEntity) : null;
  const revenueOthers = selectedEntity
    ? filteredRevenue.filter((s) => s.id !== selectedEntity)
    : [];
  const viewsOthers = selectedEntity
    ? filteredViews.filter((s) => s.id !== selectedEntity)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={null}>
            <EntityPicker
              entities={series.map((s) => ({ id: s.id, label: s.label }))}
              selected={selectedEntity}
            />
          </Suspense>
          <Suspense fallback={null}>
            <PeriodPicker defaultPreset={defaultPreset} />
          </Suspense>
        </div>

        {rangeAvailable && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Período exibido: {fmtPt(range.start)} → {fmtPt(range.end)}
          </p>
        )}
      </header>

      {hasData ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Receita acumulada" value={formatUSD(revenue)} />
            <StatCard label="Views acumuladas" value={formatInt(views)} />
            <StatCard label="RPM" value={formatUSDPrecise(rpm)} />
          </div>

          {revenueBase && viewsBase ? (
            <OverlaySection
              revenueBase={revenueBase}
              viewsBase={viewsBase}
              revenueOthers={revenueOthers}
              viewsOthers={viewsOthers}
              colors={colorMap}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <MetricChart
                series={filteredRevenue}
                metric="revenue"
                title="Receita dia a dia (USD)"
                colors={colorMap}
              />
              <MetricChart
                series={filteredViews}
                metric="views"
                title="Views dia a dia"
                colors={colorMap}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function fmtPt(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${d}/${m}/${y}`;
}
