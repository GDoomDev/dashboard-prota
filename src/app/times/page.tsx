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
import { DailyRow } from "@/lib/types";
import { colorForEntity, formatShortDate } from "@/lib/format";
import { DashboardView } from "@/components/DashboardView";
import { GoalProgress, GoalProjectedDates } from "@/components/GoalProgress";
import { CompositionChart } from "@/components/CompositionChart";
import { GoalProjectionChart, GoalChartPoint } from "@/components/GoalProjectionChart";

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
  const data = await loadDashboardData();
  const { range, revenueEnd } = resolvePeriod(data, params);
  const series = seriesPerTeam(data.segments, data.changelog);
  const selectedTeam = params.entity ?? null;

  // Historical daily rows per team (used for goal progress + projections)
  const allTeamRows = rowsByTeam(data.segments, data.changelog);

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
        selectedEntity={params.entity}
        entityLabel="times"
        rangeAvailable={Boolean(range.start && range.end)}
      />

      {/* Team selected: goal progress (single team) + composition + projection chart */}
      {selectedTeam && teamGoal && goalEntries.has(selectedTeam) && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Progresso de meta — {selectedTeam}
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

      {/* Todos selected: goal progress for all teams */}
      {!selectedTeam && data.goals.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Progresso de meta trimestral
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
    </div>
  );
}
