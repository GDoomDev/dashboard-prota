import { SegmentSeries, SegmentKind, ChangelogEntry } from "@/lib/types";
import { filterRows, teamForSegmentOnDate } from "@/lib/transforms";
import { DateRange } from "@/lib/transforms";
import { formatUSD } from "@/lib/format";

interface Props {
  segments: SegmentSeries[];
  range: DateRange;
  monthly?: boolean;
  /** When provided, cells are zeroed out for dates the segment didn't belong to this team. */
  changelog?: ChangelogEntry[];
  team?: string;
}

interface ColDef {
  segment: string;
  channel: string;
  kind: SegmentKind;
  rows: Map<string, number>; // date-key → revenue
}

function buildDateKey(date: string, monthly: boolean): string {
  if (!monthly) return date;
  return date.slice(0, 7); // "YYYY-MM"
}

function formatRowLabel(key: string, monthly: boolean): string {
  if (!monthly) {
    const [y, m, d] = key.split("-");
    return `${d}/${m}/${y}`;
  }
  const [y, m] = key.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function RevenueTable({ segments, range, monthly = false, changelog, team }: Props) {
  const filtered = segments.map((s) => ({
    ...s,
    rows: filterRows(s.rows, range),
  }));

  const longos = filtered.filter((s) => s.kind === "longos").sort((a, b) => a.channel.localeCompare(b.channel));
  const curtos = filtered.filter((s) => s.kind === "curtos").sort((a, b) => a.channel.localeCompare(b.channel));

  const cols: ColDef[] = [...longos, ...curtos].map((s) => {
    const rowMap = new Map<string, number>();
    for (const r of s.rows) {
      // Apply changelog ownership: if a team context is provided, zero out rows where this
      // segment didn't belong to that team on the given date.
      let revenue = r.revenue;
      if (changelog && team) {
        const owner = teamForSegmentOnDate(changelog, s.segment, r.date);
        if (owner !== team) revenue = 0;
      }
      const key = buildDateKey(r.date, monthly);
      rowMap.set(key, (rowMap.get(key) ?? 0) + revenue);
    }
    return { segment: s.segment, channel: s.channel, kind: s.kind, rows: rowMap };
  });

  // Collect all date keys in order (union across all columns)
  const dateSet = new Set<string>();
  for (const col of cols) {
    for (const key of col.rows.keys()) dateSet.add(key);
  }
  const dates = [...dateSet].sort();

  const rowTotals = dates.map((date) => cols.reduce((sum, col) => sum + (col.rows.get(date) ?? 0), 0));

  const longosCols = cols.filter((c) => c.kind === "longos");
  const curtosCols = cols.filter((c) => c.kind === "curtos");

  if (dates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Sem dados no período selecionado.
      </div>
    );
  }

  const thBase = "border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60";
  const tdBase = "border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs tabular-nums text-right text-zinc-700 dark:text-zinc-300";
  const tdDate = "border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap";
  // Var% cell: no default text color so conditional colors apply cleanly
  const tdVar = "border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs tabular-nums text-right font-medium";

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={`${thBase} text-left`} rowSpan={2}>
              {monthly ? "Mês" : "Data"}
            </th>
            {longosCols.length > 0 && (
              <th className={`${thBase} text-center`} colSpan={longosCols.length}>
                Longos
              </th>
            )}
            {curtosCols.length > 0 && (
              <th className={`${thBase} text-center`} colSpan={curtosCols.length}>
                Curtos
              </th>
            )}
            <th className={`${thBase} text-right`} rowSpan={2}>
              Total Geral
            </th>
            <th className={`${thBase} text-right`} rowSpan={2}>
              Var%
            </th>
          </tr>
          <tr>
            {cols.map((col, i) => (
              <th key={i} className={`${thBase} text-right capitalize`}>
                {col.channel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date, di) => {
            const total = rowTotals[di];
            const prev = di > 0 ? rowTotals[di - 1] : null;
            const varPct = prev !== null && prev > 0 ? ((total - prev) / prev) * 100 : null;
            return (
              <tr key={date} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                <td className={tdDate}>{formatRowLabel(date, monthly)}</td>
                {cols.map((col, ci) => (
                  <td key={ci} className={tdBase}>
                    {formatUSD(col.rows.get(date) ?? 0)}
                  </td>
                ))}
                <td className={`${tdBase} font-semibold text-zinc-900 dark:text-zinc-50`}>
                  {formatUSD(total)}
                </td>
                <td
                  className={`${tdVar} ${
                    varPct === null
                      ? "text-zinc-400 dark:text-zinc-500"
                      : varPct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {varPct === null ? "—" : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
          <tr className="bg-zinc-50 dark:bg-zinc-800/60 font-semibold">
            <td className={`${tdDate} font-semibold text-zinc-700 dark:text-zinc-200`}>Total</td>
            {cols.map((col, ci) => {
              const colTotal = dates.reduce((sum, d) => sum + (col.rows.get(d) ?? 0), 0);
              return (
                <td key={ci} className={`${tdBase} font-semibold text-zinc-800 dark:text-zinc-100`}>
                  {formatUSD(colTotal)}
                </td>
              );
            })}
            <td className={`${tdBase} font-bold text-zinc-900 dark:text-zinc-50`}>
              {formatUSD(rowTotals.reduce((a, b) => a + b, 0))}
            </td>
            <td className={tdBase}>—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
