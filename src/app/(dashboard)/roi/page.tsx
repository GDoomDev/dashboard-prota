import { Suspense } from "react";
import { loadDashboardData } from "@/lib/sheets";
import { latestRevenueDate, teamForSegmentOnDate } from "@/lib/transforms";
import { colorForEntity, formatUSD } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { EntityPicker } from "@/components/EntityPicker";
import { RoiComparisonChart } from "@/components/RoiComparisonChart";
import type { SegmentSeries } from "@/lib/types";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ entity?: string }>;
}

function teamKindRevenue(
  segments: SegmentSeries[],
  changelog: Parameters<typeof teamForSegmentOnDate>[0],
  team: string,
  kind: "longos" | "curtos",
  start: string,
  end: string,
): number {
  let total = 0;
  for (const seg of segments) {
    if (seg.kind !== kind) continue;
    for (const row of seg.rows) {
      if (row.date < start || row.date > end) continue;
      if (teamForSegmentOnDate(changelog, seg.segment, row.date) !== team) continue;
      total += row.revenue;
    }
  }
  return total;
}

function formatRoi(roi: number): string {
  if (!Number.isFinite(roi) || roi === 0) return "—";
  return roi.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "x";
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

export default async function RoiPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const usSegments = data.segments.filter((s) => !s.translation);
  const selectedTeam = params.entity ?? null;

  // Always fixed to last 30 days
  const anchor = latestRevenueDate(usSegments);
  const anchorDate = new Date(`${anchor}T00:00:00Z`);
  anchorDate.setUTCDate(anchorDate.getUTCDate() - 29);
  const rangeStart = anchorDate.toISOString().slice(0, 10);

  interface TeamStats {
    team: string;
    costShorts: number;
    costLongos: number;
    costGestao: number;
    costTotal: number;
    revShorts: number;
    revLongos: number;
    revTotal: number;
    roi: number;
    costPct: number;
  }

  const teamStats: TeamStats[] = data.teams.map((team) => {
    const members = data.teamMembers.filter((m) => m.team === team);
    const costShorts = members
      .filter((m) => m.level === "operacional" && m.kind === "shorts")
      .reduce((s, m) => s + m.salary, 0);
    const costLongos = members
      .filter((m) => m.level === "operacional" && m.kind === "longos")
      .reduce((s, m) => s + m.salary, 0);
    const costGestao = members
      .filter((m) => m.level === "gestao")
      .reduce((s, m) => s + m.salary, 0);
    const costTotal = members.reduce((s, m) => s + m.salary, 0);

    const revShorts = teamKindRevenue(
      usSegments,
      data.changelog,
      team,
      "curtos",
      rangeStart,
      anchor,
    );
    const revLongos = teamKindRevenue(
      usSegments,
      data.changelog,
      team,
      "longos",
      rangeStart,
      anchor,
    );
    const revTotal = revShorts + revLongos;
    const roi = costTotal > 0 ? revTotal / costTotal : 0;
    const costPct = revTotal > 0 ? (costTotal / revTotal) * 100 : Infinity;

    return { team, costShorts, costLongos, costGestao, costTotal, revShorts, revLongos, revTotal, roi, costPct };
  });

  const ranked = [...teamStats].sort((a, b) => a.costPct - b.costPct);

  const totalRevenue = teamStats.reduce((s, t) => s + t.revTotal, 0);
  const totalInvestment = teamStats.reduce((s, t) => s + t.costTotal, 0);
  const totalRoi = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;

  const selected = selectedTeam ? (teamStats.find((t) => t.team === selectedTeam) ?? null) : null;

  const hasMembers = data.teamMembers.length > 0;

  const entities = data.teams.map((t) => ({ id: t, label: t }));

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Custo por Time</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Análise de Custo sobre o Faturamento dos últimos 30 dias por Time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <EntityPicker entities={entities} selected={selectedTeam ?? undefined} />
          </Suspense>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Período: {fmtPt(rangeStart)} → {fmtPt(anchor)}
        </p>
      </header>

      {!hasMembers ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Nenhum membro encontrado. Verifique se a aba <code>times</code> está publicada na planilha.
        </div>
      ) : selected ? (
        /* ── Individual team view ── */
        <div className="flex flex-col gap-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Faturamento (30d)" value={formatUSD(selected.revTotal)} />
            <StatCard label="Custo Total (30d)" value={formatUSD(selected.costTotal)} />
            <StatCard
              label="ROI"
              value={formatRoi(selected.roi)}
              hint={`${formatPct(selected.costPct)} do faturamento em custo`}
            />
          </div>

          {/* Comparison charts — Total, Longos, Shorts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <RoiComparisonChart
              title="TOTAL"
              subtitle="Custo Total vs Faturamento"
              data={[{ name: selectedTeam ?? "Time", custoOp: selected.costShorts + selected.costLongos, custoGestao: selected.costGestao, faturamento: selected.revTotal }]}
            />
            <RoiComparisonChart
              title="LONGOS"
              subtitle="Custo Operacional vs Faturamento"
              data={[{ name: "Longos", custoOp: selected.costLongos, custoGestao: 0, faturamento: selected.revLongos }]}
            />
            <RoiComparisonChart
              title="SHORTS"
              subtitle="Custo Operacional vs Faturamento"
              data={[{ name: "Shorts", custoOp: selected.costShorts, custoGestao: 0, faturamento: selected.revShorts }]}
            />
          </div>
        </div>
      ) : (
        /* ── "Todos" overview ── */
        <div className="flex flex-col gap-6">
          {/* Global KPI cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Faturamento total (30d)" value={formatUSD(totalRevenue)} />
            <StatCard label="Custo total (30d)" value={formatUSD(totalInvestment)} />
            <StatCard label="ROI geral" value={formatRoi(totalRoi)} />
          </div>

          {/* Team ranking */}
          <section className="flex flex-col gap-3">
            <header>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Ranking por eficiência
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Ordenado pelo menor custo proporcional ao faturamento.
              </p>
            </header>
            <div className="flex flex-col gap-3">
              {ranked.map((t, i) => {
                const color = colorForEntity(t.team, i);
                const barWidth =
                  Number.isFinite(t.costPct) ? Math.min(t.costPct, 100) : 100;
                return (
                  <div
                    key={t.team}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {t.team}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm tabular-nums">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Custo{" "}
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatPct(t.costPct)}
                          </span>
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          ROI{" "}
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatRoi(t.roi)}
                          </span>
                        </span>
                      </div>
                    </div>
                    {/* Progress bar: custo% of revenue, split op (opaque) + gestão (faded) */}
                    {(() => {
                      const opFrac = t.costTotal > 0 ? (t.costTotal - t.costGestao) / t.costTotal : 1;
                      const gestaoFrac = t.costTotal > 0 ? t.costGestao / t.costTotal : 0;
                      const opWidth = barWidth * opFrac;
                      const gestaoWidth = barWidth * gestaoFrac;
                      return (
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="absolute left-0 h-full"
                            style={{ width: `${opWidth}%`, backgroundColor: color, opacity: 0.85 }}
                          />
                          <div
                            className="absolute h-full"
                            style={{ left: `${opWidth}%`, width: `${gestaoWidth}%`, backgroundColor: color, opacity: 0.3 }}
                          />
                        </div>
                      );
                    })()}
                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Custo Total {formatUSD(t.costTotal)}</span>
                      <span>Faturamento {formatUSD(t.revTotal)}</span>
                    </div>
                    {t.costTotal > 0 && t.revTotal > 0 && (
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                        <span>
                          Op.{" "}
                          <span className="font-medium text-zinc-600 dark:text-zinc-300">
                            {formatPct(((t.costTotal - t.costGestao) / t.revTotal) * 100)}
                          </span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600">·</span>
                        <span>
                          Gestão{" "}
                          <span className="font-medium text-zinc-600 dark:text-zinc-300">
                            {formatPct((t.costGestao / t.revTotal) * 100)}
                          </span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-600">·</span>
                        <span className="text-zinc-400 dark:text-zinc-500">do faturamento</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
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
