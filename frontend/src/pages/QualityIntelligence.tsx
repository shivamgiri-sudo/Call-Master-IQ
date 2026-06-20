import { useState } from 'react';
import { ShieldCheck, BarChart2, Activity, AlertTriangle } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import KpiCard from '../components/cards/KpiCard';
import QualityDistributionChart from '../components/charts/QualityDistributionChart';
import TrendLineChart from '../components/charts/TrendLineChart';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import EmptyState from '../components/states/EmptyState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { getQualityDistribution, getAnalystDailyTrend, getSplitKpis, getTopBottomAgents } from '../api/analyticsApi';
import { fmtDec, fmtInt } from '../utils/formatters';
import AnalystTable from '../components/tables/AnalystTable';

export default function QualityIntelligence() {
  const { filters, toQuery } = useFilters();
  const [activeBand, setActiveBand] = useState<string | null>(null);

  const dist = useApi(() => getQualityDistribution(toQuery()), [filters]);
  const trend = useApi(() => getAnalystDailyTrend(toQuery()), [filters]);
  const split = useApi(() => getSplitKpis(toQuery()), [filters]);
  const below = useApi(() => getTopBottomAgents({ ...toQuery(), page: 1, limit: 10 }), [filters]);

  const bands =
    dist.state.kind === 'ready' && dist.state.result.kind === 'ok'
      ? dist.state.result.data.bands || []
      : [];
  const filteredBands = activeBand ? bands.filter(b => b.label === activeBand) : bands;

  const trendData =
    trend.state.kind === 'ready' && trend.state.result.kind === 'ok'
      ? trend.state.result.data.trend.map(p => ({
          date: p.date,
          avgScore: p.avgScore ?? null,
        }))
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Quality"
        title="Quality Intelligence"
        subtitle="Distribution of quality bands, daily trend, and parameter averages."
      />
      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Avg Quality"
          icon={<ShieldCheck size={16} />}
          loading={split.state.kind === 'loading'}
          tone={
            split.state.kind === 'ready' && split.state.result.kind === 'ok'
              ? toneForAvg(split.state.result.data.avgQuality)
              : 'neutral'
          }
          value={
            split.state.kind === 'ready' && split.state.result.kind === 'ok'
              ? (split.state.result.data.avgQuality === null || split.state.result.data.avgQuality === undefined ? '—' : fmtDec(split.state.result.data.avgQuality, 1))
              : '—'
          }
        />
        <KpiCard
          label="Scored Calls"
          icon={<BarChart2 size={16} />}
          loading={split.state.kind === 'loading'}
          value={
            split.state.kind === 'ready' && split.state.result.kind === 'ok'
              ? fmtInt(split.state.result.data.qualityScoredCalls)
              : '—'
          }
        />
        <KpiCard
          label="Sales / Mixed Avg"
          icon={<Activity size={16} />}
          loading={split.state.kind === 'loading'}
          value={
            split.state.kind === 'ready' && split.state.result.kind === 'ok'
              ? fmtDec(split.state.result.data.salesMixedAvgQuality, 1)
              : '—'
          }
        />
        <KpiCard
          label="Below-target analysts"
          icon={<AlertTriangle size={16} />}
          loading={below.state.kind === 'loading'}
          value={
            below.state.kind === 'ready' && below.state.result.kind === 'ok'
              ? fmtInt((below.state.result.data.analysts || []).filter(a => (a.avgScore ?? 100) < 70).length)
              : '—'
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {renderTrendChart(trend.state, trendData)}
        </div>
        <div>
          {renderDistribution(dist.state, filteredBands, activeBand, setActiveBand)}
        </div>
      </section>

      <section className="mt-6">
        <ChartCard
          title="Parameter averages"
          subtitle="Per-parameter compliance across the selected window (Finnable only)."
          loading={dist.state.kind === 'loading'}
          empty={
            dist.state.kind === 'ready' &&
            (dist.state.result.kind === 'empty' ||
              (dist.state.result.kind === 'ok' && (dist.state.result.data.parameters || []).length === 0))
          }
        >
          {renderParameters(dist.state)}
        </ChartCard>
      </section>

      <section className="mt-6">
        <ChartCard
          title="Below-target analysts"
          subtitle="Sorted by ascending average quality."
          loading={below.state.kind === 'loading'}
          empty={false}
        >
          {renderBelow(below.state)}
        </ChartCard>
      </section>
    </>
  );
}

function toneForAvg(avg: number | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (avg === null || avg === undefined) return 'neutral';
  if (avg >= 85) return 'good';
  if (avg >= 70) return 'warn';
  return 'bad';
}

function renderTrendChart(
  state: ReturnType<typeof useApi<any>>['state'],
  data: Array<{ date: string; avgScore: number | null }>,
): JSX.Element {
  if (state.kind === 'loading') {
    return <ChartCard title="Daily quality trend" subtitle="Average score over time" loading />;
  }
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return (
      <ChartCard title="Daily quality trend" subtitle="Average score over time">
        <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />
      </ChartCard>
    );
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return (
      <ChartCard title="Daily quality trend" subtitle="Average score over time">
        <UnsupportedState reason={state.result.reason} />
      </ChartCard>
    );
  }
  if (data.length === 0) {
    return <ChartCard title="Daily quality trend" subtitle="Average score over time" empty />;
  }
  return (
    <ChartCard title="Daily quality trend" subtitle="Average score over time">
      <TrendLineChart data={data} series={[{ key: 'avgScore', label: 'Avg Quality', color: '#9D7BFF' }]} />
    </ChartCard>
  );
}

function renderDistribution(
  state: ReturnType<typeof useApi<any>>['state'],
  bands: Array<{ label: string; count: number }>,
  activeBand: string | null,
  setActiveBand: (b: string | null) => void,
): JSX.Element {
  if (state.kind === 'loading') return <ChartCard title="Quality distribution" subtitle="Calls by quality band" loading />;
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return (
      <ChartCard title="Quality distribution" subtitle="Calls by quality band">
        <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />
      </ChartCard>
    );
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return (
      <ChartCard title="Quality distribution" subtitle="Calls by quality band">
        <UnsupportedState reason={state.result.reason} />
      </ChartCard>
    );
  }
  if (bands.length === 0) {
    return <ChartCard title="Quality distribution" subtitle="Calls by quality band" empty />;
  }
  return (
    <ChartCard
      title="Quality distribution"
      subtitle={activeBand ? `Filtered: ${activeBand}` : 'Click a band to focus'}
      actions={
        activeBand ? (
          <button
            onClick={() => setActiveBand(null)}
            className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong"
          >
            Clear filter
          </button>
        ) : null
      }
    >
      <QualityDistributionChart
        bands={bands}
        onBandClick={b => setActiveBand(b.label === activeBand ? null : b.label)}
      />
    </ChartCard>
  );
}

function renderParameters(state: ReturnType<typeof useApi<any>>['state']): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} title="Parameters not available for this adapter" />;
  }
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    const params = state.result.data.parameters || [];
    if (params.length === 0) return <EmptyState title="No parameters" description="No parameter averages returned." />;
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {params.map((p: any) => (
          <div key={p.label} className="rounded-xl border border-line-subtle bg-elevated/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-primary">{p.label}</span>
              <span className="pill pill-info">{p.assessedCalls} calls</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-2xl font-semibold text-ink-primary">{fmtDec(p.average, 1)}</span>
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">avg %</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line-subtle">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet/60 to-blue/60"
                style={{ width: `${Math.max(0, Math.min(100, Number(p.average) || 0))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <LoadingSkeleton rows={3} />;
}

function renderBelow(state: ReturnType<typeof useApi<any>>['state']): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    return <AnalystTable analysts={state.result.data.analysts || []} loading={false} />;
  }
  return <LoadingSkeleton variant="table" rows={6} />;
}