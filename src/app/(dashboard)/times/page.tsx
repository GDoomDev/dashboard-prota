import { cookies } from "next/headers";
import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import {
  seriesPerTeam,
  segmentsByEverTeam,
  filterRows,
  totals,
  rowsByTeam,
  datesInRange,
  teamForSegmentOnDate,
} from "@/lib/transforms";
import { DailyRow, MonthlyGoal } from "@/lib/types";
import { colorForEntity, formatShortDate, formatUSD } from "@/lib/format";
import { DashboardView } from "@/components/DashboardView";
import { GoalProgress, GoalProjectedDates } from "@/components/GoalProgress";
import { CompositionChart } from "@/components/CompositionChart";
import { GoalProjectionChart, GoalChartPoint } from "@/components/GoalProjectionChart";
import { SegmentShareChart, TeamShare } from "@/components/SegmentShareChart";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; compare?: string; entity?: string }>;
}

/** Compute the ISO date when each meta is projected to be reached, given last-30d avg daily revenue. */
function computeProjectedDates(
  dailyRows: DailyRow[],
  current: number,
  meta1: number,
  meta2: number,
  meta3: number,
  revenueEnd: string,
): GoalProjectedDates {
  const anchor = new Date(`${revenueEnd}T00:00:00Z`);
  const start30 = new Date(anchor);
  start30.setUTCDate(start30.getUTCDate() - 29);
  const start30Str = start30.toISOString().slice(0, 10);

  const recent = dailyRows.filter((r) => r.date >= start30Str && r.date <= revenueEnd);
  const sum30 = recent.reduce((s, r) => s + r.revenue, 0);
  const avgDaily = sum30 / 30;

  function project(target: number): string | null {
    if (current >= target) return null; // already achieved
    if (avgDaily <= 0) return null; // no pace to project
    const daysNeeded = Math.ceil((target - current) / avgDaily);
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() + daysNeeded);
    return d.toISOString().slice(0, 10);
  }

  return { meta1: project(meta1), meta2: project(meta2), meta3: project(meta3) };
}

export default async function TimesPage({ searchParams }: Props) {
  const params = await searchParams;
  const jar = await cookies();
  const isAdminUser = jar.get("role")?.value !== "user";
  const data = await loadDashboardData();
  const selectedTeam = isAdminUser ? (params.entity ?? null) : null;
  const { range, revenueEnd } = resolvePeriod(data, params, {
    selectedTeam,
  });
  const series = seriesPerTeam(data.segments, data.changelog);

  // Historical daily rows per team (used for goal progress + projections)
  const allTeamRows = rowsByTeam(data.segments, data.changelog);

  // Per-team revenue split by kind (shorts / longos) for the current period
  const revenueRange = { start: range.start, end: revenueEnd || range.end };
  const shortsByTeamMap = new Map<string, number>();
  const longosByTeamMap = new Map<string, number>();
  if (range.start && range.end) {
    for (const seg of data.segments) {
      for (const row of filterRows(seg.rows, revenueRange)) {
        const team = teamForSegmentOnDate(data.changelog, seg.segment, row.date);
        if (!team) continue;
        const map = seg.kind === "curtos" ? shortsByTeamMap : longosByTeamMap;
        map.set(team, (map.get(team) ?? 0) + row.revenue);
      }
    }
  }
  const shortsShares: TeamShare[] = [...shortsByTeamMap.entries()]
    .map(([team, revenue]) => ({ team, revenue }))
    .filter((d) => d.revenue > 0);
  const longosShares: TeamShare[] = [...longosByTeamMap.entries()]
    .map(([team, revenue]) => ({ team, revenue }))
    .filter((d) => d.revenue > 0);

  // Precompute goal revenue + projected dates for every team with a goal
  type GoalEntry = {
    revenue: number;
    projected: GoalProjectedDates;
  };
  const goalEntries = new Map<string, GoalEntry>();
  for (const goal of data.goals) {
    const dailyRows = allTeamRows.get(goal.team) ?? [];
    const filtered = filterRows(dailyRows, { start: goal.start, end: revenueEnd || goal.end });
    const { revenue } = totals(filtered);
    const projected = computeProjectedDates(
      dailyRows,
      revenue,
      goal.meta1,
      goal.meta2,
      goal.meta3,
      revenueEnd,
    );
    goalEntries.set(goal.team, { revenue, projected });
  }

  // Monthly goal revenue per team
  function lastDayOfMonth(yyyyMM: string): string {
    const [y, m] = yyyyMM.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${yyyyMM}-${String(lastDay).padStart(2, "0")}`;
  }

  type MonthlyEntry = { goal: MonthlyGoal; revenue: number; pct: number; projectedDate: string | null; color: string };
  const monthlyEntries = new Map<string, MonthlyEntry>();
  for (const mg of data.monthlyGoals) {
    const monthStart = `${mg.month}-01`;
    const monthEnd = lastDayOfMonth(mg.month);
    const clampedEnd = revenueEnd < monthEnd ? revenueEnd : monthEnd;
    const teamRows = allTeamRows.get(mg.team) ?? [];
    const filtered = filterRows(teamRows, { start: monthStart, end: clampedEnd });
    const { revenue } = totals(filtered);
    const pct = mg.target > 0 ? Math.min(100, (revenue / mg.target) * 100) : 0;

    // Last-7d average daily revenue → projected date to reach target
    const anchor = new Date(`${revenueEnd}T00:00:00Z`);
    const sevenStart = new Date(anchor);
    sevenStart.setUTCDate(sevenStart.getUTCDate() - 6);
    const last7 = filterRows(teamRows, { start: sevenStart.toISOString().slice(0, 10), end: revenueEnd });
    const avgDaily = totals(last7).revenue / 7;
    let projectedDate: string | null = null;
    if (revenue < mg.target && avgDaily > 0) {
      const daysNeeded = Math.ceil((mg.target - revenue) / avgDaily);
      const proj = new Date(anchor);
      proj.setUTCDate(proj.getUTCDate() + daysNeeded);
      projectedDate = proj.toISOString().slice(0, 10);
    }

    const teamIndex = series.findIndex((s) => s.id === mg.team);
    const color = colorForEntity(mg.team, teamIndex >= 0 ? teamIndex : 0);

    monthlyEntries.set(mg.team, { goal: mg, revenue, pct, projectedDate, color });
  }

  type Slice = { id: string; label: string; value: number };

  // Composition + goal projection data for selected team
  let compositionByType: Slice[] = [];
  let compositionByChannel: Slice[] = [];
  let compositionByTypeViews: Slice[] = [];
  let compositionByChannelViews: Slice[] = [];
  let goalChartPoints: GoalChartPoint[] = [];
  let teamColor = "#4f46e5";
  let teamGoal: (typeof data.goals)[0] | null = null;

  if (selectedTeam) {
    const teamIndex = series.findIndex((s) => s.id === selectedTeam);
    teamColor = colorForEntity(selectedTeam, teamIndex >= 0 ? teamIndex : 0);

    const byTeam = segmentsByEverTeam(data.segments, data.changelog);
    const teamSegments = byTeam.get(selectedTeam) ?? [];
    const revenueRange = { start: range.start, end: revenueEnd || range.end };

    const typeRevMap = new Map<string, number>();
    const typeViewsMap = new Map<string, number>();
    const chRevMap = new Map<string, number>();
    const chViewsMap = new Map<string, number>();

    for (const seg of teamSegments) {
      const revRows = filterRows(seg.rows, revenueRange).filter(
        (r) => teamForSegmentOnDate(data.changelog, seg.segment, r.date) === selectedTeam,
      );
      const viewRows = filterRows(seg.rows, range).filter(
        (r) => teamForSegmentOnDate(data.changelog, seg.segment, r.date) === selectedTeam,
      );
      const { revenue } = totals(revRows);
      const { views } = totals(viewRows);
      typeRevMap.set(seg.kind, (typeRevMap.get(seg.kind) ?? 0) + revenue);
      typeViewsMap.set(seg.kind, (typeViewsMap.get(seg.kind) ?? 0) + views);
      chRevMap.set(seg.channel, (chRevMap.get(seg.channel) ?? 0) + revenue);
      chViewsMap.set(seg.channel, (chViewsMap.get(seg.channel) ?? 0) + views);
    }

    const kindLabel = (k: string) => (k === "longos" ? "Vídeos Longos" : "Shorts");
    const chLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

    compositionByType = [...typeRevMap.entries()].map(([id, value]) => ({ id, label: kindLabel(id), value }));
    compositionByTypeViews = [...typeViewsMap.entries()].map(([id, value]) => ({ id, label: kindLabel(id), value }));
    compositionByChannel = [...chRevMap.entries()].map(([id, value]) => ({ id, label: chLabel(id), value }));
    compositionByChannelViews = [...chViewsMap.entries()].map(([id, value]) => ({ id, label: chLabel(id), value }));

    // Goal projection line chart
    teamGoal = data.goals.find((g) => g.team === selectedTeam) ?? null;
    if (teamGoal) {
      const dailyRows = allTeamRows.get(selectedTeam) ?? [];
      const dailyMap = new Map(dailyRows.map((r) => [r.date, r.revenue]));
      const goalDates = datesInRange(teamGoal.start, teamGoal.end);
      const N = Math.max(goalDates.length - 1, 1);
      const anchor = revenueEnd || range.end;

      let cumulative = 0;
      goalChartPoints = goalDates.map((date, i) => {
        const isKnown = date <= anchor;
        if (isKnown) cumulative += dailyMap.get(date) ?? 0;
        return {
          date,
          label: formatShortDate(date),
          actual: isKnown ? cumulative : null,
          proj1: (teamGoal!.meta1 * i) / N,
          proj2: (teamGoal!.meta2 * i) / N,
          proj3: (teamGoal!.meta3 * i) / N,
        };
      });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <DashboardView
        title="Times"
        description="Performance por time considerando a atribuição temporal do changelog."
        series={series}
        range={range}
        revenueEnd={revenueEnd}
        selectedEntity={isAdminUser ? params.entity : undefined}
        entityLabel="times"
        rangeAvailable={Boolean(range.start && range.end)}
        showEntityPicker={isAdminUser}
      />

      {/* Team selected: monthly goal */}
      {selectedTeam && monthlyEntries.has(selectedTeam) && (() => {
        const me = monthlyEntries.get(selectedTeam)!;
        return (
          <section className="flex flex-col gap-3">
            <header>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Meta mensal — {selectedTeam}
              </h2>
            </header>
            <MonthlyGoalCard entry={me} />
          </section>
        );
      })()}

      {/* Team selected: goal progress (single team) + composition + projection chart */}
      {selectedTeam && teamGoal && goalEntries.has(selectedTeam) && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Meta trimestral — {selectedTeam}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Calculado sobre o período definido na aba <code>metas</code> da planilha. Projeção
              baseada na média dos últimos 30 dias.
            </p>
          </header>
          <GoalProgress
            team={selectedTeam}
            goal={teamGoal}
            current={goalEntries.get(selectedTeam)!.revenue}
            projectedDates={goalEntries.get(selectedTeam)!.projected}
          />
        </section>
      )}

      {selectedTeam && goalChartPoints.length > 0 && teamGoal && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Projeção de metas — {selectedTeam}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Acumulado real comparado às trajetórias lineares para cada meta do trimestre.
            </p>
          </header>
          <GoalProjectionChart
            points={goalChartPoints}
            teamColor={teamColor}
            todayDate={revenueEnd}
            goalStart={teamGoal.start}
            goalEnd={teamGoal.end}
          />
        </section>
      )}

      {selectedTeam && compositionByType.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Composição — {selectedTeam}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Receita e views do período selecionado quebradas por tipo e por canal.
            </p>
          </header>
          <CompositionChart
            byType={compositionByType}
            byChannel={compositionByChannel}
            byTypeViews={compositionByTypeViews}
            byChannelViews={compositionByChannelViews}
          />
        </section>
      )}

      {/* Todos selected: monthly goals for all teams */}
      {!selectedTeam && monthlyEntries.size > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Meta mensal
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Progresso de receita acumulada no mês corrente em relação à meta definida na planilha.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...monthlyEntries.values()]
              .sort((a, b) => b.pct - a.pct)
              .map((me) => (
                <MonthlyGoalCard key={me.goal.team} entry={me} />
              ))}
          </div>
        </section>
      )}

      {/* Todos selected: goal progress for all teams */}
      {!selectedTeam && data.goals.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Meta trimestral
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Calculado sobre o período definido na aba <code>metas</code> da planilha. Projeção
              baseada na média dos últimos 30 dias.
            </p>
          </header>
          <div className="flex flex-col gap-4">
            {[...data.goals]
              .sort((a, b) => {
                const ra = goalEntries.get(a.team)?.revenue ?? 0;
                const rb = goalEntries.get(b.team)?.revenue ?? 0;
                return rb - ra;
              })
              .map((goal) => {
                const entry = goalEntries.get(goal.team);
                return (
                  <GoalProgress
                    key={goal.team}
                    team={goal.team}
                    goal={goal}
                    current={entry?.revenue ?? 0}
                    projectedDates={entry?.projected}
                  />
                );
              })}
          </div>
        </section>
      )}

      {/* Todos selected: shorts vs longos share per team */}
      {!selectedTeam && (shortsShares.length > 0 || longosShares.length > 0) && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Shorts vs Longos — Participação por Time
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Parcela do faturamento total de cada segmento atribuída a cada time no período.
            </p>
          </header>
          <SegmentShareChart shorts={shortsShares} longos={longosShares} />
        </section>
      )}
    </div>
  );
}

function MonthlyGoalCard({ entry }: { entry: { goal: MonthlyGoal; revenue: number; pct: number; projectedDate: string | null; color: string } }) {
  const { goal, revenue, pct, projectedDate, color } = entry;
  const [y, m] = goal.month.split("-");
  const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const reached = revenue >= goal.target;

  function fmtDate(iso: string): string {
    const [fy, fm, fd] = iso.split("-");
    return `${fd}/${fm}/${fy}`;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{goal.team}</span>
        <span className="text-xs text-zinc-400 capitalize">{monthLabel}</span>
      </div>
      <div className="mb-3 flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatUSD(revenue)}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          / {formatUSD(goal.target)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {pct.toFixed(1)}%
        </span>
        {reached ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Meta atingida ✓</span>
        ) : projectedDate ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Projetado atingir em: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{fmtDate(projectedDate)}</span>
          </span>
        ) : (
          <span className="text-xs text-zinc-400">Sem dados suficientes</span>
        )}
      </div>
    </div>
  );
}
