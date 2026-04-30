import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import { seriesPerChannel, filterRows, totals } from "@/lib/transforms";
import { DashboardView } from "@/components/DashboardView";
import { CompositionChart } from "@/components/CompositionChart";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; compare?: string; entity?: string }>;
}

export default async function CanaisPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const { range, revenueEnd } = resolvePeriod(data, params, {
    selectedChannel: params.entity ?? null,
  });
  const series = seriesPerChannel(data.segments);

  const selectedCanal = params.entity ?? null;

  // When a canal is selected, show only its segments; otherwise show all
  const scopedSegments = selectedCanal
    ? data.segments.filter((s) => s.channel === selectedCanal)
    : data.segments;

  const revenueRange = { start: range.start, end: revenueEnd || range.end };
  const kindRevMap = new Map<string, number>();
  const kindViewsMap = new Map<string, number>();

  for (const seg of scopedSegments) {
    const revRows = filterRows(seg.rows, revenueRange);
    const viewRows = filterRows(seg.rows, range);
    const { revenue } = totals(revRows);
    const { views } = totals(viewRows);
    kindRevMap.set(seg.kind, (kindRevMap.get(seg.kind) ?? 0) + revenue);
    kindViewsMap.set(seg.kind, (kindViewsMap.get(seg.kind) ?? 0) + views);
  }

  const kindLabel = (k: string) => (k === "longos" ? "Vídeos Longos" : "Shorts");
  const byTypeRevenue = [...kindRevMap.entries()].map(([id, value]) => ({ id, label: kindLabel(id), value }));
  const byTypeViews = [...kindViewsMap.entries()].map(([id, value]) => ({ id, label: kindLabel(id), value }));

  const compositionTitle = selectedCanal
    ? `Composição — ${selectedCanal.charAt(0).toUpperCase() + selectedCanal.slice(1)}`
    : "Composição geral";
  const compositionDesc = selectedCanal
    ? `Receita e views do canal divididas entre Vídeos Longos e Shorts.`
    : `Receita e views do período divididas entre Vídeos Longos e Shorts.`;

  return (
    <div className="flex flex-col gap-8">
      <DashboardView
        title="Canais"
        description="Comparativo por canal, somando Vídeos Longos e Shorts."
        series={series}
        range={range}
        revenueEnd={revenueEnd}
        selectedEntity={params.entity}
        entityLabel="canais"
        rangeAvailable={Boolean(range.start && range.end)}
      />

      {byTypeRevenue.length > 0 && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {compositionTitle}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{compositionDesc}</p>
          </header>
          <CompositionChart byType={byTypeRevenue} byTypeViews={byTypeViews} />
        </section>
      )}
    </div>
  );
}
