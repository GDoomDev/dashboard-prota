import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import {
  franchiseForChannel,
  seriesPerTeam,
  teamForSegmentOnDate,
  titleCase,
} from "@/lib/transforms";
import { DashboardView } from "@/components/DashboardView";
import { formatInt, formatUSD } from "@/lib/format";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string }>;
}

interface Breakdown {
  usRevenue: number;
  tradRevenue: number;
  usViews: number;
  tradViews: number;
}

function emptyBreakdown(): Breakdown {
  return { usRevenue: 0, tradRevenue: 0, usViews: 0, tradViews: 0 };
}

type Row = { key: string; label: string } & Breakdown;

function toRows(map: Map<string, Breakdown>, label: (k: string) => string): Row[] {
  return [...map.entries()]
    .map(([key, b]) => ({ key, label: label(key), ...b }))
    .filter((r) => r.usRevenue + r.tradRevenue + r.usViews + r.tradViews > 0)
    .sort((a, b) => b.usRevenue + b.tradRevenue - (a.usRevenue + a.tradRevenue));
}

export default async function ResumoPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const { range, revenueEnd } = resolvePeriod(data, params);

  const revenueRange = { start: range.start, end: revenueEnd || range.end };

  // Combined daily series per team (US + tradução) for the overview chart/KPIs.
  const series = seriesPerTeam(data.segments, data.changelog);

  // Per-team and per-franchise breakdown, splitting US vs tradução.
  // A franchise groups a US channel with its translated counterparts (e.g.
  // "dave" + "davebr"/"davede"/"davees"/"davefr").
  const byTeam = new Map<string, Breakdown>();
  const byFranchise = new Map<string, Breakdown>();

  for (const seg of data.segments) {
    const franchise = franchiseForChannel(seg.channel, seg.translation);
    const fBucket = byFranchise.get(franchise) ?? emptyBreakdown();
    for (const row of seg.rows) {
      const inRevenue = row.date >= revenueRange.start && row.date <= revenueRange.end;
      const inViews = row.date >= range.start && row.date <= range.end;
      if (!inRevenue && !inViews) continue;

      // Franchise bucket
      if (seg.translation) {
        if (inRevenue) fBucket.tradRevenue += row.revenue;
        if (inViews) fBucket.tradViews += row.views;
      } else {
        if (inRevenue) fBucket.usRevenue += row.revenue;
        if (inViews) fBucket.usViews += row.views;
      }

      // Team bucket (attributed per changelog ownership on the date)
      const team = teamForSegmentOnDate(data.changelog, seg.segment, row.date);
      if (team) {
        const tBucket = byTeam.get(team) ?? emptyBreakdown();
        if (seg.translation) {
          if (inRevenue) tBucket.tradRevenue += row.revenue;
          if (inViews) tBucket.tradViews += row.views;
        } else {
          if (inRevenue) tBucket.usRevenue += row.revenue;
          if (inViews) tBucket.usViews += row.views;
        }
        byTeam.set(team, tBucket);
      }
    }
    byFranchise.set(franchise, fBucket);
  }

  const teamRows = toRows(byTeam, (k) => k);
  const franchiseRows = toRows(byFranchise, titleCase);

  return (
    <div className="flex flex-col gap-8">
      <DashboardView
        title="Resumo"
        description="Visão consolidada somando Canais US e Tradução, por time e por canal."
        series={series}
        range={range}
        revenueEnd={revenueEnd}
        entityLabel="times"
        rangeAvailable={Boolean(range.start && range.end)}
        showEntityPicker={false}
      />

      {teamRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Por Time</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Receita e views de cada time no período, somando Canais US e Tradução.
            </p>
          </header>
          <SummaryTable firstColLabel="Time" rows={teamRows} />
        </section>
      )}

      {franchiseRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Por Franquia</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Receita e views de cada franquia no período, unindo o canal US aos seus canais de
              tradução.
            </p>
          </header>
          <SummaryTable firstColLabel="Franquia" rows={franchiseRows} />
        </section>
      )}
    </div>
  );
}

function SummaryTable({ firstColLabel, rows }: { firstColLabel: string; rows: Row[] }) {
  const totalUs = rows.reduce((s, r) => s + r.usRevenue, 0);
  const totalTrad = rows.reduce((s, r) => s + r.tradRevenue, 0);
  const totalRev = totalUs + totalTrad;
  const totalViews = rows.reduce((s, r) => s + r.usViews + r.tradViews, 0);

  const th = "border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
  const td = "border-b border-zinc-100 dark:border-zinc-800/60 px-4 py-2.5 text-sm tabular-nums text-zinc-700 dark:text-zinc-300";

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-left`}>{firstColLabel}</th>
            <th className={`${th} text-right`}>Canais US</th>
            <th className={`${th} text-right`}>Tradução</th>
            <th className={`${th} text-right`}>Total</th>
            <th className={`${th} text-right`}>Views</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
              <td className={`${td} font-medium text-zinc-900 dark:text-zinc-50`}>{r.label}</td>
              <td className={`${td} text-right`}>{formatUSD(r.usRevenue)}</td>
              <td className={`${td} text-right`}>{formatUSD(r.tradRevenue)}</td>
              <td className={`${td} text-right font-semibold text-zinc-900 dark:text-zinc-50`}>
                {formatUSD(r.usRevenue + r.tradRevenue)}
              </td>
              <td className={`${td} text-right text-zinc-500 dark:text-zinc-400`}>
                {formatInt(r.usViews + r.tradViews)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-50 font-semibold dark:bg-zinc-800/60">
            <td className={`${td} text-zinc-700 dark:text-zinc-200`}>Total</td>
            <td className={`${td} text-right text-zinc-800 dark:text-zinc-100`}>{formatUSD(totalUs)}</td>
            <td className={`${td} text-right text-zinc-800 dark:text-zinc-100`}>{formatUSD(totalTrad)}</td>
            <td className={`${td} text-right font-bold text-zinc-900 dark:text-zinc-50`}>{formatUSD(totalRev)}</td>
            <td className={`${td} text-right text-zinc-500 dark:text-zinc-400`}>{formatInt(totalViews)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
