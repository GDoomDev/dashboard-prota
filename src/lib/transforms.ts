import {
  ChangelogEntry,
  DailyRow,
  DashboardData,
  SegmentSeries,
  TeamGoal,
} from "./types";

export type PeriodPreset = "7d" | "30d" | "90d" | "tri" | "2026" | "custom";

export interface DateRange {
  start: string;
  end: string;
}

export interface NamedSeries {
  id: string;
  label: string;
  rows: DailyRow[];
}

/**
 * Returns the [start, end] ISO range for a preset.
 * `revenueAnchor` drives the start date (last day with real revenue).
 * `dataEnd` is the actual range end (may be 1 day after revenueAnchor if
 * the last spreadsheet row has 0 revenue but valid views).
 */
export function rangeForPreset(
  preset: Exclude<PeriodPreset, "custom">,
  revenueAnchor: string,
  dataEnd: string,
): DateRange {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const d = new Date(`${revenueAnchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { start: d.toISOString().slice(0, 10), end: dataEnd };
}

/** Find the latest date present in any segment series. */
export function latestDate(segments: SegmentSeries[]): string {
  let latest = "";
  for (const s of segments) {
    for (const r of s.rows) if (r.date > latest) latest = r.date;
  }
  return latest;
}

/**
 * Find the latest date that has revenue > 0 across all segments.
 * Used as anchor for period presets so that a trailing zero-revenue day
 * (revenue not yet reported by the platform) is excluded from revenue ranges.
 */
export function latestRevenueDate(segments: SegmentSeries[]): string {
  let latest = "";
  for (const s of segments) {
    for (const r of s.rows) {
      if (r.revenue > 0 && r.date > latest) latest = r.date;
    }
  }
  return latest || latestDate(segments);
}

/** Inclusive filter on ISO date strings. */
export function filterRows(rows: DailyRow[], range: DateRange): DailyRow[] {
  return rows.filter((r) => r.date >= range.start && r.date <= range.end);
}

/** Sum two daily series by date. Missing dates contribute 0. */
export function sumByDate(series: DailyRow[][]): DailyRow[] {
  const map = new Map<string, DailyRow>();
  for (const rows of series) {
    for (const r of rows) {
      const cur = map.get(r.date);
      if (cur) {
        cur.revenue += r.revenue;
        cur.views += r.views;
      } else {
        map.set(r.date, { date: r.date, revenue: r.revenue, views: r.views });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function totals(rows: DailyRow[]): { revenue: number; views: number } {
  let revenue = 0;
  let views = 0;
  for (const r of rows) {
    revenue += r.revenue;
    views += r.views;
  }
  return { revenue, views };
}

/**
 * Returns the team that owns `segment` on `date` based on the changelog.
 * Picks the most recent entry whose date is <= the given date.
 */
export function teamForSegmentOnDate(
  changelog: ChangelogEntry[],
  segment: string,
  date: string,
): string | null {
  let owner: string | null = null;
  for (const entry of changelog) {
    if (entry.segment !== segment) continue;
    if (entry.date <= date) owner = entry.team;
    else break; // changelog is sorted asc by date
  }
  return owner;
}

/**
 * Group every segment row into the team that owned that segment on that date.
 * Returns one summed series per team.
 */
export function rowsByTeam(
  segments: SegmentSeries[],
  changelog: ChangelogEntry[],
): Map<string, DailyRow[]> {
  const buckets = new Map<string, Map<string, DailyRow>>();
  for (const seg of segments) {
    for (const row of seg.rows) {
      const team = teamForSegmentOnDate(changelog, seg.segment, row.date);
      if (!team) continue;
      let dateMap = buckets.get(team);
      if (!dateMap) {
        dateMap = new Map();
        buckets.set(team, dateMap);
      }
      const cur = dateMap.get(row.date);
      if (cur) {
        cur.revenue += row.revenue;
        cur.views += row.views;
      } else {
        dateMap.set(row.date, { date: row.date, revenue: row.revenue, views: row.views });
      }
    }
  }
  const result = new Map<string, DailyRow[]>();
  for (const [team, dateMap] of buckets) {
    result.set(team, [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return result;
}

export function seriesPerChannel(segments: SegmentSeries[]): NamedSeries[] {
  const grouped = new Map<string, DailyRow[][]>();
  for (const seg of segments) {
    if (!grouped.has(seg.channel)) grouped.set(seg.channel, []);
    grouped.get(seg.channel)!.push(seg.rows);
  }
  return [...grouped.entries()]
    .map(([channel, rows]) => ({
      id: channel,
      label: titleCase(channel),
      rows: sumByDate(rows),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function seriesPerSegmentKind(
  segments: SegmentSeries[],
  kind: "longos" | "curtos",
): NamedSeries[] {
  return segments
    .filter((s) => s.kind === kind)
    .map((s) => ({ id: s.channel, label: titleCase(s.channel), rows: s.rows }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function seriesPerTeam(
  segments: SegmentSeries[],
  changelog: ChangelogEntry[],
): NamedSeries[] {
  const map = rowsByTeam(segments, changelog);
  return [...map.entries()]
    .map(([team, rows]) => ({ id: team, label: team, rows }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Cumulative revenue from goal start through end of data, by team. */
export function teamRevenueInGoalWindow(
  data: DashboardData,
  goal: TeamGoal,
): { revenue: number; rows: DailyRow[] } {
  const teamRows = rowsByTeam(data.segments, data.changelog).get(goal.team) ?? [];
  const filtered = filterRows(teamRows, { start: goal.start, end: goal.end });
  const { revenue } = totals(filtered);
  return { revenue, rows: filtered };
}

/** Generate every ISO date from start to end inclusive. */
export function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/** Returns the team that currently owns a segment (latest changelog entry). */
export function currentTeamForSegment(
  changelog: ChangelogEntry[],
  segment: string,
): string | null {
  let team: string | null = null;
  for (const entry of changelog) {
    if (entry.segment === segment) team = entry.team;
  }
  return team;
}

/** Group SegmentSeries by their current team (latest changelog assignment). */
export function segmentsByCurrentTeam(
  segments: SegmentSeries[],
  changelog: ChangelogEntry[],
): Map<string, SegmentSeries[]> {
  const result = new Map<string, SegmentSeries[]>();
  for (const seg of segments) {
    const team = currentTeamForSegment(changelog, seg.segment);
    if (!team) continue;
    if (!result.has(team)) result.set(team, []);
    result.get(team)!.push(seg);
  }
  return result;
}

/**
 * Group SegmentSeries by every team they have EVER been assigned to.
 * A segment that moved from Falco → Astra → Phoenix will appear in all three.
 * This is the correct grouping for historical revenue reports so that periods
 * spent under a given team are always attributed to that team.
 */
export function segmentsByEverTeam(
  segments: SegmentSeries[],
  changelog: ChangelogEntry[],
): Map<string, SegmentSeries[]> {
  const result = new Map<string, SegmentSeries[]>();
  for (const seg of segments) {
    const teams = new Set<string>();
    for (const entry of changelog) {
      if (entry.segment === seg.segment) teams.add(entry.team);
    }
    for (const team of teams) {
      if (!result.has(team)) result.set(team, []);
      result.get(team)!.push(seg);
    }
  }
  return result;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Returns the team that currently owns a channel (via the most recent changelog entry for any of its segments). */
export function currentTeamForChannel(
  segments: SegmentSeries[],
  changelog: ChangelogEntry[],
  channel: string,
): string | null {
  const channelSegments = segments.filter((s) => s.channel === channel);
  for (const seg of channelSegments) {
    const team = currentTeamForSegment(changelog, seg.segment);
    if (team) return team;
  }
  return null;
}
