import { TeamGoal } from "@/lib/types";
import { formatUSD } from "@/lib/format";

export interface GoalProjectedDates {
  meta1: string | null;
  meta2: string | null;
  meta3: string | null;
}

interface Props {
  team: string;
  goal: TeamGoal;
  current: number;
  projectedDates?: GoalProjectedDates;
}

export function GoalProgress({ team, goal, current, projectedDates }: Props) {
  const milestones = [
    { label: "Meta 1", value: goal.meta1, projected: projectedDates?.meta1 ?? null },
    { label: "Meta 2", value: goal.meta2, projected: projectedDates?.meta2 ?? null },
    { label: "Meta 3", value: goal.meta3, projected: projectedDates?.meta3 ?? null },
  ];
  const max = Math.max(goal.meta3, current, 1);
  const fillPct = Math.min(100, (current / max) * 100);
  const labelLeft = Math.min(Math.max(fillPct, 5), 91);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{team}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Período: {formatPeriod(goal.start)} → {formatPeriod(goal.end)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Receita acumulada
          </p>
          <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatUSD(current)}
          </p>
        </div>
      </div>

      {/* Progress timeline */}
      <div className="relative">
        {/* Current value badge — floats above the fill endpoint */}
        <div className="relative mb-1 h-7">
          <div
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${labelLeft}%`, transform: "translateX(-50%)" }}
          >
            <span className="whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              {formatUSD(current)}
            </span>
            <span className="mt-0.5 h-1.5 w-px bg-zinc-400 dark:bg-zinc-500" />
          </div>
        </div>

        {/* Bar */}
        <div className="relative h-4 w-full overflow-visible rounded-full bg-zinc-100 dark:bg-zinc-800">
          {/* Fill gradient */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-indigo-500"
            style={{ width: `${fillPct}%` }}
          />
          {/* Milestone markers */}
          {milestones.map((m) => {
            const mPct = Math.min(100, (m.value / max) * 100);
            return (
              <div
                key={m.label}
                className="absolute top-[-4px] bottom-[-4px] w-[3px] -translate-x-px rounded-sm bg-white/70 shadow-sm dark:bg-zinc-900/80"
                style={{ left: `${mPct}%` }}
              />
            );
          })}
        </div>

        {/* Milestone value labels — below the bar */}
        <div className="relative mt-1.5 h-9">
          {milestones.map((m) => {
            const mPct = Math.min(100, (m.value / max) * 100);
            const align =
              mPct < 12 ? "left-0 text-left" : mPct > 88 ? "right-0 text-right" : "-translate-x-1/2 text-center";
            return (
              <div
                key={m.label}
                className={`absolute top-0 ${align}`}
                style={mPct >= 12 && mPct <= 88 ? { left: `${mPct}%` } : undefined}
              >
                <div className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {m.label}
                </div>
                <div className="text-[10px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                  {formatUSD(m.value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone detail cards */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {milestones.map((m) => {
          const reached = current >= m.value;
          const pct = m.value > 0 ? Math.min(100, (current / m.value) * 100) : 0;
          return (
            <div
              key={m.label}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-1">
                {/* Left: label, value, projected date */}
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {m.label}
                  </span>
                  <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatUSD(m.value)}
                  </p>
                  {!reached && m.projected && (
                    <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                      <p className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        Projetado atingir em:
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {formatPeriod(m.projected)}
                      </p>
                    </div>
                  )}
                </div>
                {/* Right: status badge */}
                <div className="flex-shrink-0">
                  {reached ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      ✓
                    </span>
                  ) : (
                    <span className="text-[10px] tabular-nums text-zinc-500">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatPeriod(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y) return iso;
  return `${d}/${m}/${y}`;
}
