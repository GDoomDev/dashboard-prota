export type SegmentKind = "longos" | "curtos";

export type SegmentId = `${string}_${SegmentKind}`;

export interface DailyRow {
  date: string;
  revenue: number;
  views: number;
}

export interface SegmentSeries {
  segment: SegmentId;
  channel: string;
  kind: SegmentKind;
  rows: DailyRow[];
}

export interface ChangelogEntry {
  segment: SegmentId;
  date: string;
  team: string;
}

export interface TeamGoal {
  team: string;
  start: string;
  end: string;
  meta1: number;
  meta2: number;
  meta3: number;
}

export interface SheetTab {
  name: string;
  gid: string;
}

export interface DashboardData {
  channels: string[];
  teams: string[];
  segments: SegmentSeries[];
  changelog: ChangelogEntry[];
  goals: TeamGoal[];
  fetchedAt: string;
}
