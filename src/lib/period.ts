import {
  DateRange,
  PeriodPreset,
  latestDate,
  latestRevenueDate,
  rangeForPreset,
  currentTeamForChannel,
} from "./transforms";
import { DashboardData } from "./types";

export interface ResolvedPeriod {
  preset: PeriodPreset;
  range: DateRange;
  revenueEnd: string;
}

export interface ResolvePeriodOptions {
  defaultPreset?: PeriodPreset;
  selectedTeam?: string | null;
  selectedChannel?: string | null;
}

/** Returns the start and end ISO dates for the current calendar quarter (UTC). */
function currentQuarterRange(): DateRange {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const q = Math.floor(month / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
  const startMonth = q * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2; // 2, 5, 8, 11
  const lastDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(startMonth + 1)}-01`,
    end: `${year}-${pad(endMonth + 1)}-${pad(lastDay)}`,
  };
}

export function resolvePeriod(
  data: DashboardData,
  searchParams: { preset?: string; start?: string; end?: string },
  options: ResolvePeriodOptions = {},
): ResolvedPeriod {
  const { defaultPreset = "30d", selectedTeam, selectedChannel } = options;
  const revenueEnd = latestRevenueDate(data.segments);
  const dataEnd = latestDate(data.segments);
  const preset = (searchParams.preset ?? defaultPreset) as PeriodPreset;

  if (preset === "custom" && searchParams.start && searchParams.end) {
    return {
      preset,
      range: { start: searchParams.start, end: searchParams.end },
      revenueEnd: searchParams.end,
    };
  }

  if (preset === "2026") {
    return {
      preset: "2026",
      range: { start: "2026-01-01", end: dataEnd },
      revenueEnd,
    };
  }

  if (preset === "tri") {
    let range: DateRange;
    if (selectedTeam) {
      const goal = data.goals.find((g) => g.team === selectedTeam);
      range = goal ? { start: goal.start, end: goal.end } : currentQuarterRange();
    } else if (selectedChannel) {
      const team = currentTeamForChannel(data.segments, data.changelog, selectedChannel);
      const goal = team ? data.goals.find((g) => g.team === team) : null;
      range = goal ? { start: goal.start, end: goal.end } : currentQuarterRange();
    } else {
      range = currentQuarterRange();
    }
    return { preset: "tri", range, revenueEnd };
  }

  const validDay = (p: PeriodPreset): p is "7d" | "30d" | "90d" =>
    p === "7d" || p === "30d" || p === "90d";

  const safe: "7d" | "30d" | "90d" = validDay(preset)
    ? preset
    : validDay(defaultPreset)
      ? defaultPreset
      : "30d";

  if (!revenueEnd) {
    return { preset: safe, range: { start: "", end: "" }, revenueEnd: "" };
  }

  return {
    preset: safe,
    range: rangeForPreset(safe, revenueEnd, dataEnd),
    revenueEnd,
  };
}
