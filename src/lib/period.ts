import { DateRange, PeriodPreset, latestDate, latestRevenueDate, rangeForPreset } from "./transforms";
import { DashboardData } from "./types";

export interface ResolvedPeriod {
  preset: PeriodPreset;
  range: DateRange;
  revenueEnd: string;
}

export function resolvePeriod(
  data: DashboardData,
  searchParams: { preset?: string; start?: string; end?: string },
  defaultPreset: PeriodPreset = "30d",
): ResolvedPeriod {
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

  const safe: Exclude<PeriodPreset, "custom" | "2026"> =
    preset === "7d" || preset === "30d" || preset === "90d" ? preset : defaultPreset === "7d" || defaultPreset === "30d" || defaultPreset === "90d" ? defaultPreset : "30d";

  if (!revenueEnd) {
    return { preset: safe, range: { start: "", end: "" }, revenueEnd: "" };
  }

  return {
    preset: safe,
    range: rangeForPreset(safe, revenueEnd, dataEnd),
    revenueEnd,
  };
}
