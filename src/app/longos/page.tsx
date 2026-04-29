import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import { seriesPerSegmentKind } from "@/lib/transforms";
import { DashboardView } from "@/components/DashboardView";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; compare?: string; entity?: string }>;
}

export default async function LongosPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const { range, revenueEnd } = resolvePeriod(data, params);
  const series = seriesPerSegmentKind(data.segments, "longos");
  return (
    <DashboardView
      title="Vídeos Longos"
      description="Comparativo apenas entre os segmentos de Vídeos Longos de cada canal."
      series={series}
      range={range}
      revenueEnd={revenueEnd}
      selectedEntity={params.entity}
      entityLabel="canais"
      rangeAvailable={Boolean(range.start && range.end)}
    />
  );
}
