import {
  ChangelogEntry,
  DailyRow,
  DashboardData,
  MemberKind,
  MemberLevel,
  SegmentSeries,
  SheetTab,
  TeamGoal,
  TeamMember,
} from "./types";
import { parseCsv, parseDate, parseLocaleNumber } from "./parsers";

const SHEET_PUB_ID =
  process.env.SHEET_PUB_ID ??
  "2PACX-1vQQR6Plf3PGtkgKU50kPad95HNTrKLjr9XX-2sPiyQDGVSDjNawlJs_s6lwlFcaIGLc4IyGt6vSrKw5";

const PUBHTML = `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pubhtml`;
const CSV_BASE = `https://docs.google.com/spreadsheets/d/e/${SHEET_PUB_ID}/pub`;

const REVALIDATE_SECONDS = Number(process.env.SHEET_REVALIDATE ?? 300);

const SEGMENT_PATTERN = /^([a-z0-9-]+)_(longos|curtos)$/i;

/**
 * Discover all tabs from the published HTML.
 * The pubhtml does not include a clean tab manifest, so we parse the inline
 * JS for "<name>" ... gid=<digits> pairs. The first occurrence of the name
 * before its gid is used.
 */
async function discoverTabs(): Promise<SheetTab[]> {
  const res = await fetch(PUBHTML, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) {
    throw new Error(`Failed to fetch pubhtml: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const tabs: SheetTab[] = [];
  const seen = new Set<string>();
  // Each tab is emitted as: items.push({name: "tab_name", pageUrl: "...&gid=NNN", gid: "NNN",...})
  const re = /name:\s*"([^"]+)"[^}]+gid:\s*"(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1];
    const gid = m[2];
    const key = `${name}:${gid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tabs.push({ name, gid });
  }
  // De-duplicate by name (keep first gid encountered)
  const byName = new Map<string, string>();
  for (const t of tabs) if (!byName.has(t.name)) byName.set(t.name, t.gid);
  return [...byName.entries()].map(([name, gid]) => ({ name, gid }));
}

async function fetchCsv(gid: string): Promise<string[][]> {
  const url = `${CSV_BASE}?gid=${gid}&single=true&output=csv`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) {
    throw new Error(`Failed to fetch csv gid=${gid}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseCsv(text);
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])),
  );
}

function parseSegmentSheet(tab: SheetTab, raw: string[][]): SegmentSeries {
  const match = SEGMENT_PATTERN.exec(tab.name);
  if (!match) {
    throw new Error(`Tab ${tab.name} does not match segment pattern`);
  }
  const channel = match[1].toLowerCase();
  const kind = match[2].toLowerCase() as "longos" | "curtos";
  const objs = rowsToObjects(raw);
  const rows: DailyRow[] = [];
  for (const o of objs) {
    const dateRaw = o["Date"] ?? o["date"] ?? "";
    if (!dateRaw) continue;
    const revRaw = o["Estimated revenue (USD)"] ?? o["Revenue"] ?? "";
    const viewsRaw = o["Views"] ?? o["views"] ?? "";
    const date = parseDate(dateRaw);
    const revenue = parseLocaleNumber(revRaw);
    const views = parseLocaleNumber(viewsRaw);
    if (!date || Number.isNaN(views)) continue;
    rows.push({ date, revenue: Number.isNaN(revenue) ? 0 : revenue, views });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { segment: `${channel}_${kind}`, channel, kind, rows };
}

function parseChangelog(raw: string[][]): ChangelogEntry[] {
  const objs = rowsToObjects(raw);
  const out: ChangelogEntry[] = [];
  for (const o of objs) {
    const segment = (o["Dados"] ?? o["dados"] ?? "").toLowerCase();
    const dateRaw = o["Data"] ?? o["data"] ?? "";
    const team = (o["Time"] ?? o["time"] ?? "").trim();
    if (!segment || !dateRaw || !team) continue;
    if (!SEGMENT_PATTERN.test(segment)) continue;
    out.push({ segment: segment as `${string}_longos` | `${string}_curtos`, date: parseDate(dateRaw), team });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function parseGoals(raw: string[][]): TeamGoal[] {
  const objs = rowsToObjects(raw);
  const out: TeamGoal[] = [];
  for (const o of objs) {
    const team = (o["Time"] ?? o["time"] ?? "").trim();
    if (!team) continue;
    out.push({
      team,
      start: parseDate(o["Inicio Meta"] ?? o["Início Meta"] ?? ""),
      end: parseDate(o["Fim Meta"] ?? ""),
      meta1: parseLocaleNumber(o["Meta 1"] ?? ""),
      meta2: parseLocaleNumber(o["Meta 2"] ?? ""),
      meta3: parseLocaleNumber(o["Meta 3"] ?? ""),
    });
  }
  return out;
}

function parseTeamMembers(raw: string[][]): TeamMember[] {
  // Find the "Dolar" column by header name and read the exchange rate from row 2 (index 1)
  const headers = raw[0] ?? [];
  const dolarCol = headers.findIndex((h) =>
    h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === "dolar",
  );
  const exchangeRaw = dolarCol >= 0 ? (raw[1]?.[dolarCol] ?? "") : "";
  const exchangeRate = parseLocaleNumber(exchangeRaw);
  const hasRate = Number.isFinite(exchangeRate) && exchangeRate > 0;
  console.log("[parseTeamMembers] dolarCol:", dolarCol, "exchangeRaw:", JSON.stringify(exchangeRaw), "exchangeRate:", exchangeRate, "hasRate:", hasRate);

  const objs = rowsToObjects(raw);
  const out: TeamMember[] = [];
  for (const o of objs) {
    const name = (o["Nome"] ?? o["nome"] ?? "").trim();
    const team = (o["Time"] ?? o["time"] ?? "").trim();
    const kindRaw = (o["Segmento"] ?? o["segmento"] ?? o["Tipo"] ?? o["tipo"] ?? "")
      .toLowerCase()
      .trim();
    const levelRaw = (o["Nível"] ?? o["Nivel"] ?? o["nivel"] ?? o["Level"] ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
    const salaryRaw = o["Salário"] ?? o["Salario"] ?? o["salario"] ?? o["salário"] ?? "";

    if (!name || !team) continue;

    const kind: MemberKind = kindRaw === "longos" ? "longos" : "shorts";
    const level: MemberLevel = levelRaw === "gestao" ? "gestao" : "operacional";
    const salaryBrl = parseLocaleNumber(salaryRaw);

    if (Number.isNaN(salaryBrl) || salaryBrl <= 0) continue;

    // Convert BRL → USD using the exchange rate in cell I2 of the sheet (raw[1][8])
    const salary = hasRate ? salaryBrl / exchangeRate : salaryBrl;

    out.push({ name, team, kind, level, salary });
  }
  return out;
}

export async function loadDashboardData(): Promise<DashboardData> {
  const tabs = await discoverTabs();
  const segmentTabs = tabs.filter((t) => SEGMENT_PATTERN.test(t.name));
  const changelogTab = tabs.find((t) => t.name.toLowerCase() === "changelog");
  const metasTab = tabs.find((t) => t.name.toLowerCase() === "metas");
  const timesTab = tabs.find((t) => t.name.toLowerCase() === "times");

  const [segmentResults, changelogRows, metasRows, timesRows] = await Promise.all([
    Promise.all(
      segmentTabs.map(async (t) => parseSegmentSheet(t, await fetchCsv(t.gid))),
    ),
    changelogTab ? fetchCsv(changelogTab.gid) : Promise.resolve([] as string[][]),
    metasTab ? fetchCsv(metasTab.gid) : Promise.resolve([] as string[][]),
    timesTab ? fetchCsv(timesTab.gid) : Promise.resolve([] as string[][]),
  ]);

  const segments = segmentResults.filter((s) => s.rows.length > 0);
  const changelog = parseChangelog(changelogRows);
  const goals = parseGoals(metasRows);
  const teamMembers = parseTeamMembers(timesRows);

  const channels = [...new Set(segments.map((s) => s.channel))].sort();
  const teams = [
    ...new Set([
      ...changelog.map((c) => c.team),
      ...goals.map((g) => g.team),
    ]),
  ].sort();

  return {
    channels,
    teams,
    segments,
    changelog,
    goals,
    teamMembers,
    fetchedAt: new Date().toISOString(),
  };
}
