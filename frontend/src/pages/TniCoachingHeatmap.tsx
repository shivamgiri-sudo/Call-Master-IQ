import { useMemo, useState } from 'react';
import { Flame, Crosshair, BookOpen } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import KpiCard from '../components/cards/KpiCard';
import TniHeatmapChart, { type TniCell } from '../components/charts/TniHeatmapChart';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import EmptyState from '../components/states/EmptyState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { getTniHeatmap } from '../api/analyticsApi';

export default function TniCoachingHeatmap() {
  const { filters, toQuery } = useFilters();
  const tni = useApi(() => getTniHeatmap(toQuery()), [filters]);

  const cells = useMemo<TniCell[]>(() => {
    if (tni.state.kind !== 'ready' || tni.state.result.kind !== 'ok') return [];
    const data = tni.state.result.data;
    const heatmap = data.heatmap || [];
    const out: TniCell[] = [];
    for (const row of heatmap) {
      for (const cell of row.values || []) {
        out.push({
          rowLabel: row.parameter, // engine structure: heatmap[].parameter is actually a row label (analyst/process); values per date bucket. We use parameter as a proxy.
          columnLabel: cell.date,
          value: typeof cell.score === 'number' ? cell.score / 100 : 0.5,
          rawValue: cell.score,
        });
      }
    }
    // Derive aggregate TNI from processTNI as a top-level summary
    return out;
  }, [tni.state]);

  const tniSummary =
    tni.state.kind === 'ready' && tni.state.result.kind === 'ok'
      ? tni.state.result.data.processTNI || []
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Coaching"
        title="TNI / Coaching Heatmap"
        subtitle="Parameter-level coaching priorities. Brighter cells indicate higher TNI / better coverage."
      />
      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total TNI records"
          icon={<Flame size={16} />}
          tone="info"
          loading={tni.state.kind === 'loading'}
          value={tni.state.kind === 'ready' && tni.state.result.kind === 'ok' ? String((tni.state.result.data.tni || []).length) : '—'}
        />
        <KpiCard
          label="Processes tracked"
          icon={<Crosshair size={16} />}
          tone="neutral"
          loading={tni.state.kind === 'loading'}
          value={String(tniSummary.length)}
        />
        <KpiCard
          label="Fatal findings"
          icon={<Flame size={16} />}
          tone="bad"
          loading={tni.state.kind === 'loading'}
          value={String((tni.state.kind === 'ready' && tni.state.result.kind === 'ok' ? (tni.state.result.data.tni || []).reduce((s, t) => s + (t.fatal || 0), 0) : 0))}
        />
        <KpiCard
          label="Defect findings"
          icon={<BookOpen size={16} />}
          tone="warn"
          loading={tni.state.kind === 'loading'}
          value={String((tni.state.kind === 'ready' && tni.state.result.kind === 'ok' ? (tni.state.result.data.tni || []).reduce((s, t) => s + (t.defect || 0), 0) : 0))}
        />
      </section>

      <section>
        <ChartCard
          title="TNI heatmap"
          subtitle="Process × Date parameter coverage. Click a cell for the underlying call list."
          loading={tni.state.kind === 'loading'}
          empty={cells.length === 0}
          height={420}
        >
          {renderHeatmap(tni.state, cells)}
        </ChartCard>
      </section>

      {tniSummary.length > 0 ? (
        <section className="mt-6">
          <ChartCard
            title="Process TNI ranking"
            subtitle="Higher is better (1.0 = clean)."
            loading={false}
          >
            <div className="space-y-2">
              {tniSummary.map((p: any) => (
                <div key={p.process} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 truncate text-sm text-ink-primary">{p.process}</div>
                  <div className="h-1.5 w-48 overflow-hidden rounded-full bg-line-subtle">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet/70 to-blue/70"
                      style={{ width: `${Math.max(0, Math.min(100, (Number(p.tni) || 0) * 100))}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs text-ink-muted">
                    {Math.round((Number(p.tni) || 0) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </section>
      ) : null}
    </>
  );
}

function renderHeatmap(state: ReturnType<typeof useApi<any>>['state'], cells: TniCell[]): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (cells.length === 0) {
    return <EmptyState title="No TNI records" description="No coaching triggers in the selected window." />;
  }
  return <TniHeatmapChart cells={cells} rowTitle="Parameter" columnTitle="Date" />;
}

const _BookOpen = BookOpen; void _BookOpen;