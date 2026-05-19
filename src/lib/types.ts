export type SegmentKind = "longos" | "curtos";

export type MemberKind = "shorts" | "longos";
export type MemberLevel = "operacional" | "gestao";

export interface TeamMember {
  name: string;
  team: string;
  kind: MemberKind;
  level: MemberLevel;
  salary: number;
}

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
  translation: boolean;
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

export interface MonthlyGoal {
  team: string;
  month: string; // "YYYY-MM"
  target: number;
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
  monthlyGoals: MonthlyGoal[];
  teamMembers: TeamMember[];
  fetchedAt: string;
}
