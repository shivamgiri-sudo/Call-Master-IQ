import { TrendingUp, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import KpiCard from '../components/cards/KpiCard';
import SalesFunnelChart from '../components/charts/SalesFunnelChart';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import EmptyState from '../components/states/EmptyState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { getSalesFunnel, getLeakageReport } from '../api/analyticsApi';
import { fmtInt, fmtPct } from '../utils/formatters';
import type { SalesFunnelStage } from '../api/types';

export default function SalesFunnelIntelligence() {
  const { filters, toQuery } = useFilters();
  const navigate = useNavigate();

  const funnel = useApi(() => getSalesFunnel(toQuery()), [filters]);
  const leakage = useApi(() => getLeakageReport(toQuery()), [filters]);

  const stages =
    funnel.state.kind === 'ready' && funnel.state.result.kind === 'ok'
      ? funnel.state.result.data.stages || []
      : [];
  const total =
    funnel.state.kind === 'ready' && funnel.state.result.kind === 'ok'
      ? funnel.state.result.data.totalOpportunities ?? 0
      : 0;

  const stageClicks = (stage: SalesFunnelStage) => {
    navigate(`/evidence?dimension=funnel&value=${encodeURIComponent(stage.stage)}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sales Funnel Intelligence"
        subtitle="Stage-by-stage conversion, leakage drivers, and pricing objections."
      />
      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Opportunities"
          icon={<TrendingUp size={16} />}
          tone="info"
          value={fmtInt(total)}
          loading={funnel.state.kind === 'loading'}
        />
        <KpiCard
          label="Pitched"
          icon={<ListChecks size={16} />}
          tone="info"
          value={stageCount(stages, 'Pitch Attempted')}
          loading={funnel.state.kind === 'loading'}
        />
        <KpiCard
          label="Strong Pitch"
          icon={<ListChecks size={16} />}
          tone="good"
          value={stageCount(stages, 'Strong Pitch')}
          loading={funnel.state.kind === 'loading'}
        />
        <KpiCard
          label="Disbursal Signal"
          icon={<TrendingUp size={16} />}
          tone="good"
          value={stageCount(stages, 'Disbursal Signal')}
          loading={funnel.state.kind === 'loading'}
        />
      </section>

      <section className="mb-6">
        <ChartCard
          title="Sales funnel"
          subtitle="Click a stage to drill down. Conversion rates are between consecutive stages."
          loading={funnel.state.kind === 'loading'}
          empty={
            funnel.state.kind === 'ready' &&
            (funnel.state.result.kind === 'empty' ||
              (funnel.state.result.kind === 'ok' && stages.length === 0))
          }
        >
          {renderFunnel(funnel.state, stages, stageClicks)}
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Leakage reasons"
          subtitle="Top reasons opportunities fail to convert."
          loading={leakage.state.kind === 'loading'}
          empty={
            leakage.state.kind === 'ready' &&
            leakage.state.result.kind === 'ok' &&
            (leakage.state.result.data.leakage || []).length === 0
          }
        >
          {renderCountList(leakage.state, 'leakage')}
        </ChartCard>
        <ChartCard
          title="Pricing / discount"
          subtitle="Pricing transparency breakdown."
          loading={leakage.state.kind === 'loading'}
          empty={
            leakage.state.kind === 'ready' &&
            leakage.state.result.kind === 'ok' &&
            (leakage.state.result.data.pricing || []).length === 0
          }
        >
          {renderCountList(leakage.state, 'pricing')}
        </ChartCard>
        <ChartCard
          title="Top objection categories"
          subtitle="Customer objections raised during pitches."
          loading={leakage.state.kind === 'loading'}
          empty={
            leakage.state.kind === 'ready' &&
            leakage.state.result.kind === 'ok' &&
            (leakage.state.result.data.objections || []).length === 0
          }
        >
          {renderCountList(leakage.state, 'objections')}
        </ChartCard>
      </section>
    </>
  );
}

function stageCount(stages: SalesFunnelStage[], label: string): string {
  const s = stages.find(x => x.stage === label);
  return s ? fmtInt(s.count) : '—';
}

function renderFunnel(
  state: ReturnType<typeof useApi<any>>['state'],
  stages: SalesFunnelStage[],
  onStageClick: (s: SalesFunnelStage) => void,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok' && stages.length > 0) {
    return <SalesFunnelChart stages={stages} onStageClick={onStageClick} />;
  }
  return <LoadingSkeleton variant="chart" />;
}

function renderCountList(
  state: ReturnType<typeof useApi<any>>['state'],
  key: 'leakage' | 'pricing' | 'objections',
): JSX.Element {
  if (state.kind === 'loading') return <LoadingSkeleton rows={4} />;
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    const items = state.result.data[key] || [];
    if (items.length === 0) return <EmptyState title="No records" />;
    const total = items.reduce((s: number, b: any) => s + (b.count || 0), 0) || 1;
    return (
      <div className="space-y-2.5">
        {items.map((b: any) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className="min-w-0 flex-1 truncate text-sm text-ink-primary">{b.label}</div>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-line-subtle">
              <div
                className="h-full rounded-full bg-gradient-to-r from-warn/70 to-bad/70"
                style={{ width: `${Math.round(((b.count || 0) / total) * 100)}%` }}
              />
            </div>
            <div className="w-16 text-right text-xs text-ink-muted">
              {fmtInt(b.count)} · {fmtPct((b.count || 0) / total, 0)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <LoadingSkeleton rows={4} />;
}
