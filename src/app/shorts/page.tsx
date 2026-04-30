import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import { seriesPerSegmentKind } from "@/lib/transforms";
import { DashboardView } from "@/components/DashboardView";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; compare?: string; entity?: string }>;
}

export default async function ShortsPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const { range, revenueEnd } = resolvePeriod(data, params, {
    selectedChannel: params.entity ?? null,
  });
  const series = seriesPerSegmentKind(data.segments, "curtos");
  return (
    <DashboardView
      title="Shorts"
      description="Comparativo apenas entre os segmentos de Shorts de cada canal."
      series={series}
      range={range}
      revenueEnd={revenueEnd}
      selectedEntity={params.entity}
      entityLabel="canais"
      rangeAvailable={Boolean(range.start && range.end)}
    />
  );
}
