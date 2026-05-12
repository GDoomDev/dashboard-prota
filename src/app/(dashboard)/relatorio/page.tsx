import { Suspense } from "react";
import { loadDashboardData } from "@/lib/sheets";
import { resolvePeriod } from "@/lib/period";
import { segmentsByEverTeam } from "@/lib/transforms";
import { EntityPicker } from "@/components/EntityPicker";
import { PeriodPicker } from "@/components/PeriodPicker";
import { RevenueTable } from "@/components/RevenueTable";

export const revalidate = 300;

interface Props {
  searchParams: Promise<{ preset?: string; start?: string; end?: string; entity?: string }>;
}

export default async function RelatorioPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await loadDashboardData();

  const byTeam = segmentsByEverTeam(data.segments, data.changelog);
  const teams = [...byTeam.keys()].sort();

  const selectedTeam = params.entity && byTeam.has(params.entity) ? params.entity : teams[0] ?? null;

  const { range, revenueEnd } = resolvePeriod(data, params, {
    defaultPreset: "2026",
    selectedTeam,
  });
  const segments = selectedTeam ? (byTeam.get(selectedTeam) ?? []) : [];

  const revenueRange = { start: range.start, end: revenueEnd || range.end };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Relatório</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Detalhamento de receita por segmento, agrupado por time.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={null}>
            <EntityPicker
              entities={teams.map((t) => ({ id: t, label: t }))}
              selected={selectedTeam ?? undefined}
              hideTodos
            />
          </Suspense>
          <Suspense fallback={null}>
            <PeriodPicker />
          </Suspense>
        </div>
      </header>

      {selectedTeam && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Receita diária — {selectedTeam}
            </h2>
            <RevenueTable segments={segments} range={revenueRange} monthly={false} changelog={data.changelog} team={selectedTeam} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Receita mensal — {selectedTeam}
            </h2>
            <RevenueTable segments={segments} range={revenueRange} monthly={true} changelog={data.changelog} team={selectedTeam} />
          </section>
        </>
      )}
    </div>
  );
}
