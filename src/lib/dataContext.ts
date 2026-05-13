import type { DashboardData, ChangelogEntry } from "./types";

function buildTeamChannelMap(changelog: ChangelogEntry[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const entry of changelog) {
    const channel = entry.segment.split("_")[0];
    if (!map[entry.team]) map[entry.team] = new Set();
    map[entry.team].add(channel);
  }
  return Object.fromEntries(
    Object.entries(map).map(([team, channels]) => [team, [...channels]])
  );
}

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function fmtNum(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtRevenue(n: number) {
  return `$${n.toFixed(2)}`;
}

/** Builds a concise text context of the last `daysBack` days for all teams. */
export function buildChatContext(data: DashboardData, daysBack = 30): string {
  const cutoff = nDaysAgo(daysBack);
  const today = new Date().toISOString().split("T")[0];
  const teamChannels = buildTeamChannelMap(data.changelog);

  const lines: string[] = [
    `# Dashboard Prota — Dados para Análise`,
    `Data atual: ${today} | Período padrão: últimos ${daysBack} dias (desde ${cutoff})`,
    "",
  ];

  // Goals
  if (data.goals.length) {
    lines.push("## Metas por Time");
    for (const g of data.goals) {
      lines.push(
        `### ${g.team}: Meta1=${fmtNum(g.meta1)} | Meta2=${fmtNum(g.meta2)} | Meta3=${fmtNum(g.meta3)} views (${g.start} → ${g.end})`
      );
    }
    lines.push("");
  }

  // Team members / salaries
  if (data.teamMembers.length) {
    lines.push("## Composição e Custo dos Times (salário em USD)");
    const byTeam: Record<string, typeof data.teamMembers> = {};
    for (const m of data.teamMembers) {
      if (!byTeam[m.team]) byTeam[m.team] = [];
      byTeam[m.team].push(m);
    }
    for (const [team, members] of Object.entries(byTeam)) {
      const total = members.reduce((s, m) => s + m.salary, 0);
      lines.push(`### ${team} — custo total: ${fmtRevenue(total)}/mês`);
      for (const m of members) {
        lines.push(`  - ${m.name} (${m.kind}, ${m.level}): ${fmtRevenue(m.salary)}/mês`);
      }
    }
    lines.push("");
  }

  // Performance per team
  lines.push(`## Performance por Time (últimos ${daysBack} dias)`);

  for (const [team, channels] of Object.entries(teamChannels)) {
    lines.push(`### Time: ${team} | Canais: ${channels.join(", ")}`);

    for (const channel of channels) {
      for (const seg of data.segments) {
        if (seg.channel !== channel) continue;

        const rows = seg.rows.filter((r) => r.date >= cutoff);
        if (!rows.length) continue;

        const totalViews = rows.reduce((s, r) => s + r.views, 0);
        const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
        const avgViews = Math.round(totalViews / rows.length);

        lines.push(
          `#### ${seg.segment} — ${fmtNum(totalViews)} views | ${fmtRevenue(totalRevenue)} | média ${fmtNum(avgViews)}/dia`
        );
        lines.push("| Data | Views | Receita |");
        lines.push("|------|-------|---------|");
        for (const r of rows) {
          lines.push(`| ${r.date} | ${fmtNum(r.views)} | ${fmtRevenue(r.revenue)} |`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Detects team mentions in a message and returns the appropriate context.
 * Single/multiple teams → filtered context. No match → full context.
 */
export function buildContextForMessage(data: DashboardData, message: string, daysBack = 14): string {
  const msgLower = message.toLowerCase();
  const matched = data.teams.filter((t) => msgLower.includes(t.toLowerCase()));

  if (matched.length === 0) return buildChatContext(data, daysBack);
  return matched.map((t) => buildTeamContext(data, t, daysBack)).join("\n\n---\n\n");
}

/** Builds context for a single team, used in weekly reports. */
export function buildTeamContext(data: DashboardData, team: string, daysBack = 7): string {
  const cutoff = nDaysAgo(daysBack);
  const prevCutoff = nDaysAgo(daysBack * 2);
  const teamChannels = buildTeamChannelMap(data.changelog);
  const channels = teamChannels[team] ?? [];

  const goal = data.goals.find((g) => g.team === team);
  const members = data.teamMembers.filter((m) => m.team === team);

  const lines: string[] = [`# Time: ${team}`, ""];

  if (goal) {
    lines.push(`## Meta: ${fmtNum(goal.meta1)} views até ${goal.end}`);
    lines.push("");
  }

  if (members.length) {
    const totalCost = members.reduce((s, m) => s + m.salary, 0);
    lines.push(`## Custo do time: ${fmtRevenue(totalCost)}/mês`);
    lines.push("");
  }

  for (const channel of channels) {
    for (const seg of data.segments) {
      if (seg.channel !== channel) continue;

      const curr = seg.rows.filter((r) => r.date >= cutoff);
      const prev = seg.rows.filter((r) => r.date >= prevCutoff && r.date < cutoff);

      if (!curr.length) continue;

      const currViews = curr.reduce((s, r) => s + r.views, 0);
      const prevViews = prev.reduce((s, r) => s + r.views, 0);
      const currRev = curr.reduce((s, r) => s + r.revenue, 0);
      const prevRev = prev.reduce((s, r) => s + r.revenue, 0);

      const viewsDelta = prevViews > 0 ? ((currViews - prevViews) / prevViews) * 100 : null;
      const revDelta = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : null;

      lines.push(`## ${seg.segment}`);
      lines.push(
        `- Semana atual: ${fmtNum(currViews)} views | ${fmtRevenue(currRev)}`
      );
      lines.push(
        `- Semana anterior: ${fmtNum(prevViews)} views | ${fmtRevenue(prevRev)}`
      );
      if (viewsDelta !== null) {
        lines.push(`- Variação views: ${viewsDelta > 0 ? "+" : ""}${viewsDelta.toFixed(1)}%`);
      }
      if (revDelta !== null) {
        lines.push(`- Variação receita: ${revDelta > 0 ? "+" : ""}${revDelta.toFixed(1)}%`);
      }
      lines.push("| Data | Views | Receita |");
      lines.push("|------|-------|---------|");
      for (const r of curr) {
        lines.push(`| ${r.date} | ${fmtNum(r.views)} | ${fmtRevenue(r.revenue)} |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
