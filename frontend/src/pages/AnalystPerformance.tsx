import { useState } from 'react';
import { Users, Trophy, ArrowDown, ArrowUp } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import KpiCard from '../components/cards/KpiCard';
import AnalystTable from '../components/tables/AnalystTable';
import EvidenceDrawer from '../components/evidence/EvidenceDrawer';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { getTopBottomAgents } from '../api/analyticsApi';
import { fmtDec, fmtInt } from '../utils/formatters';
import type { RiskQueueRecord } from '../api/types';

export default function AnalystPerformance() {
  const { filters, toQuery } = useFilters();
  const [open, setOpen] = useState<RiskQueueRecord | null>(null);

  const top = useApi(() => getTopBottomAgents({ ...toQuery(), page: 1, limit: 100 }), [filters]);

  const data = top.state.kind === 'ready' && top.state.result.kind === 'ok' ? top.state.result.data : null;
  const analysts = data?.analysts || [];

  const sortedByScoreAsc = [...analysts].sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999));
  const sortedByScoreDesc = [...analysts].sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

  const bottom3 = sortedByScoreAsc.slice(0, 3);
  const top3 = sortedByScoreDesc.slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analyst Performance"
        subtitle="Top and bottom analysts, sortable by score / risk / volume."
      />
      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total analysts" icon={<Users size={16} />} value={fmtInt(analysts.length)} loading={top.state.kind === 'loading'} />
        <KpiCard label="Top avg score" icon={<Trophy size={16} />} tone="good"
          value={top3[0]?.avgScore === undefined || top3[0]?.avgScore === null ? '—' : fmtDec(top3[0].avgScore, 1)}
          hint={top3[0]?.agentName}
          loading={top.state.kind === 'loading'}
        />
        <KpiCard label="Bottom avg score" icon={<ArrowDown size={16} />} tone="bad"
          value={bottom3[0]?.avgScore === undefined || bottom3[0]?.avgScore === null ? '—' : fmtDec(bottom3[0].avgScore, 1)}
          hint={bottom3[0]?.agentName}
          loading={top.state.kind === 'loading'}
        />
        <KpiCard label="High-risk occurrences" icon={<ArrowUp size={16} />} tone="warn"
          value={fmtInt(analysts.reduce((s, a) => s + (a.highRiskCount || 0), 0))}
          loading={top.state.kind === 'loading'}
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Top 3 analysts" subtitle="By avg quality score" loading={false}>
          <TopList analysts={top3} tone="good" />
        </ChartCard>
        <ChartCard title="Bottom 3 analysts" subtitle="By avg quality score" loading={false}>
          <TopList analysts={bottom3} tone="bad" />
        </ChartCard>
      </section>

      <section>
        <ChartCard title="All analysts" subtitle="Search, sort, and click a row to view call list." loading={top.state.kind === 'loading'}>
          {renderTable(top.state, analysts, setOpen)}
        </ChartCard>
      </section>

      <EvidenceDrawer record={open} onClose={() => setOpen(null)} />
    </>
  );
}

function renderTable(
  state: ReturnType<typeof useApi<any>>['state'],
  analysts: any[],
  setOpen: (r: RiskQueueRecord) => void,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    return (
      <AnalystTable
        analysts={analysts}
        onRowClick={a => setOpen({
          id: String(a.agentName ?? 'unknown'),
          analyst: String(a.agentName ?? 'Unknown'),
          date: a.lastCallDate ?? '',
          qualityScore: a.avgScore ?? 'N/A',
          qualityBand: a.avgScore && a.avgScore >= 85 ? 'Excellent' : a.avgScore && a.avgScore >= 70 ? 'Good' : 'High Risk',
          riskBucket: (a.highRiskCount || 0) > 0 ? 'High Priority Risk Trigger' : 'No Risk Flag',
          insight: `${fmtInt(a.totalCalls)} calls · ${fmtInt(a.highRiskCount)} high-risk · ${fmtInt(a.opportunities)} opportunities`,
        })}
        loading={false}
      />
    );
  }
  return <LoadingSkeleton variant="table" rows={6} />;
}

function TopList({ analysts, tone }: { analysts: any[]; tone: 'good' | 'bad' }) {
  if (analysts.length === 0) return <EmptySmall />;
  return (
    <ol className="space-y-3">
      {analysts.map((a, i) => (
        <li key={`${a.agentName || 'analyst'}-${i}`} className="flex items-center gap-4">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
            tone === 'good' ? 'border-good/30 bg-good/10 text-good' : 'border-bad/30 bg-bad/10 text-bad'
          }`}>
            <span className="text-sm font-semibold">{i + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink-primary">{a.agentName}</div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">{fmtInt(a.totalCalls)} calls</div>
          </div>
          <div className={`text-right text-lg font-semibold ${tone === 'good' ? 'text-good' : 'text-bad'}`}>
            {a.avgScore === null || a.avgScore === undefined ? '—' : fmtDec(a.avgScore, 1)}
          </div>
        </li>
      ))}
    </ol>
  );
}

function EmptySmall() {
  return <p className="text-sm text-ink-muted">Not enough analysts in this window.</p>;
}

void UnsupportedState;
