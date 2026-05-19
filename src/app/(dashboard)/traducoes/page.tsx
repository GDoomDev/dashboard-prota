import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import {
  seriesPerTeam,
  segmentsByEverTeam,
  filterRows,
  totals,
  teamForSegmentOnDate,
  titleCase,
} from "@/lib/transforms";
import { DashboardView } from "@/components/DashboardView";
import { CompositionChart } from "@/components/CompositionChart";
import { SegmentShareChart, TeamShare } from "@/components/SegmentShareChart";
import { colorForEntity, formatUSD, formatInt } from "@/lib/format";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; entity?: string }>;
}

type Slice = { id: string; label: string; value: number };

export default async function TraducoesPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const tradSegments = data.segments.filter((s) => s.translation);

  const selectedTeam = params.entity ?? null;
  const { range, revenueEnd } = resolvePeriod(data, params, { selectedTeam });

  const series = seriesPerTeam(tradSegments, data.changelog);
  const revenueRange = { start: range.start, end: revenueEnd || range.end };

  // ── Dados globais (Todos view) ──────────────────────────────────────────────
  const kindRevMap = new Map<string, number>();
  const kindViewsMap = new Map<string, number>();
  const chRevMap = new Map<string, number>();
  const chViewsMap = new Map<string, number>();
  // Por canal dentro de cada kind (para os rankings por segmento)
  const chLongosRev = new Map<string, number>();
  const chCurtosRev = new Map<string, number>();
  const chLongosViews = new Map<string, number>();
  const chCurtosViews = new Map<string, number>();

  for (const seg of tradSegments) {
    const revRows = filterRows(seg.rows, revenueRange);
    const viewRows = filterRows(seg.rows, range);
    const { revenue } = totals(revRows);
    const { views } = totals(viewRows);
    kindRevMap.set(seg.kind, (kindRevMap.get(seg.kind) ?? 0) + revenue);
    kindViewsMap.set(seg.kind, (kindViewsMap.get(seg.kind) ?? 0) + views);
    chRevMap.set(seg.channel, (chRevMap.get(seg.channel) ?? 0) + revenue);
    chViewsMap.set(seg.channel, (chViewsMap.get(seg.channel) ?? 0) + views);
    if (seg.kind === "longos") {
      chLongosRev.set(seg.channel, (chLongosRev.get(seg.channel) ?? 0) + revenue);
      chLongosViews.set(seg.channel, (chLongosViews.get(seg.channel) ?? 0) + views);
    } else {
      chCurtosRev.set(seg.channel, (chCurtosRev.get(seg.channel) ?? 0) + revenue);
      chCurtosViews.set(seg.channel, (chCurtosViews.get(seg.channel) ?? 0) + views);
    }
  }

  const kindLabel = (k: string) => (k === "longos" ? "Vídeos Longos" : "Shorts");
  const byTypeRevenue: Slice[] = [...kindRevMap.entries()].map(([id, value]) => ({
    id,
    label: kindLabel(id),
    value,
  }));
  const byTypeViews: Slice[] = [...kindViewsMap.entries()].map(([id, value]) => ({
    id,
    label: kindLabel(id),
    value,
  }));
  const byChannelRevenue: Slice[] = [...chRevMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: titleCase(id), value }));
  const byChannelViews: Slice[] = [...chViewsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, label: titleCase(id), value }));

  // Rankings por canal dentro de cada segmento
  const longosRanking = [...chLongosRev.entries()]
    .map(([channel, revenue]) => ({ channel, revenue, views: chLongosViews.get(channel) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const curtosRanking = [...chCurtosRev.entries()]
    .map(([channel, revenue]) => ({ channel, revenue, views: chCurtosViews.get(channel) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalLongosRev = longosRanking.reduce((s, c) => s + c.revenue, 0);
  const totalCurtosRev = curtosRanking.reduce((s, c) => s + c.revenue, 0);

  // Distribuição por time
  const shortsByTeam = new Map<string, number>();
  const longosByTeam = new Map<string, number>();
  for (const seg of tradSegments) {
    for (const row of filterRows(seg.rows, revenueRange)) {
      const team = teamForSegmentOnDate(data.changelog, seg.segment, row.date);
      if (!team) continue;
      const map = seg.kind === "curtos" ? shortsByTeam : longosByTeam;
      map.set(team, (map.get(team) ?? 0) + row.revenue);
    }
  }
  const shortsShares: TeamShare[] = [...shortsByTeam.entries()]
    .map(([team, revenue]) => ({ team, revenue }))
    .filter((d) => d.revenue > 0);
  const longosShares: TeamShare[] = [...longosByTeam.entries()]
    .map(([team, revenue]) => ({ team, revenue }))
    .filter((d) => d.revenue > 0);

  // ── Dados do time selecionado ───────────────────────────────────────────────
  let teamByType: Slice[] = [];
  let teamByChannel: Slice[] = [];
  let teamByTypeViews: Slice[] = [];
  let teamByChannelViews: Slice[] = [];

  if (selectedTeam) {
    const byTeam = segmentsByEverTeam(tradSegments, data.changelog);
    const teamSegs = byTeam.get(selectedTeam) ?? [];
    const typeRevMap = new Map<string, number>();
    const typeViewsMap = new Map<string, number>();
    const chRevTeam = new Map<string, number>();
    const chViewsTeam = new Map<string, number>();

    for (const seg of teamSegs) {
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
      chRevTeam.set(seg.channel, (chRevTeam.get(seg.channel) ?? 0) + revenue);
      chViewsTeam.set(seg.channel, (chViewsTeam.get(seg.channel) ?? 0) + views);
    }

    teamByType = [...typeRevMap.entries()].map(([id, value]) => ({
      id,
      label: kindLabel(id),
      value,
    }));
    teamByTypeViews = [...typeViewsMap.entries()].map(([id, value]) => ({
      id,
      label: kindLabel(id),
      value,
    }));
    teamByChannel = [...chRevTeam.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => ({ id, label: titleCase(id), value }));
    teamByChannelViews = [...chViewsTeam.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, value]) => ({ id, label: titleCase(id), value }));
  }

  const hasData = tradSegments.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <DashboardView
        title="Traduções"
        description="Desempenho dos canais de tradução, atribuídos por time conforme o changelog."
        series={series}
        range={range}
        revenueEnd={revenueEnd}
        selectedEntity={params.entity}
        entityLabel="times"
        rangeAvailable={Boolean(range.start && range.end)}
        entityItems={data.teams.map((t) => ({ id: t, label: t }))}
      />

      {!hasData && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Nenhuma aba de tradução encontrada na planilha. Adicione abas no formato{" "}
          <code>canal_longos_trad</code> ou <code>canal_curtos_trad</code>.
        </div>
      )}

      {/* ── Visão Todos ──────────────────────────────────────────────────────── */}

      {hasData && !selectedTeam && byTypeRevenue.length > 0 && (
        <>
          {/* Composição geral: shorts vs longos + por canal */}
          <section className="flex flex-col gap-3">
            <header>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Composição Geral
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Receita e views do período divididas entre Vídeos Longos e Shorts, e por canal.
              </p>
            </header>
            <CompositionChart
              byType={byTypeRevenue}
              byChannel={byChannelRevenue}
              byTypeViews={byTypeViews}
              byChannelViews={byChannelViews}
            />
          </section>

          {/* Rankings por segmento */}
          {(longosRanking.length > 0 || curtosRanking.length > 0) && (
            <section className="flex flex-col gap-3">
              <header>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Canais por Segmento
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Participação de cada canal de tradução no total de Vídeos Longos e no total de Shorts.
                </p>
              </header>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {longosRanking.length > 0 && (
                  <ChannelRankingCard
                    title="Vídeos Longos — por Canal"
                    items={longosRanking}
                    total={totalLongosRev}
                  />
                )}
                {curtosRanking.length > 0 && (
                  <ChannelRankingCard
                    title="Shorts — por Canal"
                    items={curtosRanking}
                    total={totalCurtosRev}
                  />
                )}
              </div>
            </section>
          )}

          {/* Distribuição por time */}
          {(shortsShares.length > 0 || longosShares.length > 0) && (
            <section className="flex flex-col gap-3">
              <header>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Distribuição por Time
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Como a receita de tradução está distribuída entre os times, separada por tipo de
                  conteúdo.
                </p>
              </header>
              <SegmentShareChart shorts={shortsShares} longos={longosShares} />
            </section>
          )}
        </>
      )}

      {/* ── Visão por Time ───────────────────────────────────────────────────── */}

      {hasData && selectedTeam && teamByType.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Composição — {selectedTeam}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Como cada frente de tradução compõe a receita e as views do time no período.
            </p>
          </header>
          <CompositionChart
            byType={teamByType}
            byChannel={teamByChannel}
            byTypeViews={teamByTypeViews}
            byChannelViews={teamByChannelViews}
          />
        </section>
      )}
    </div>
  );
}

function ChannelRankingCard({
  title,
  items,
  total,
}: {
  title: string;
  items: { channel: string; revenue: number; views: number }[];
  total: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => {
          const pct = total > 0 ? (item.revenue / total) * 100 : 0;
          const color = colorForEntity(item.channel, i);
          return (
            <div key={item.channel}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {titleCase(item.channel)}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums text-zinc-500 dark:text-zinc-400">
                  <span>{formatInt(item.views)} views</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatUSD(item.revenue)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <p className="mt-0.5 text-right text-xs text-zinc-400 dark:text-zinc-500">
                {pct.toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
