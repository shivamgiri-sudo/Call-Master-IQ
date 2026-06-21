import { useState } from 'react';
import { AlertOctagon, ShieldAlert, X } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import KpiCard from '../components/cards/KpiCard';
import RiskByProcessChart from '../components/charts/RiskByProcessChart';
import RiskQueueTable from '../components/tables/RiskQueueTable';
import EvidenceDrawer from '../components/evidence/EvidenceDrawer';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import EmptyState from '../components/states/EmptyState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { getRiskQueue, getRiskByProcess, getComplianceSummary } from '../api/analyticsApi';
import { fmtInt } from '../utils/formatters';
import type { RiskByProcessRow, RiskQueueRecord } from '../api/types';

export default function RiskComplianceQueue() {
  const { filters, toQuery } = useFilters();
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [open, setOpen] = useState<RiskQueueRecord | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);

  const queue = useApi(() => getRiskQueue({
    ...toQuery(),
    ...(selectedProcess ? { process_name: selectedProcess } : {}),
    page,
    limit,
  }), [filters, page, selectedProcess]);
  const byProc = useApi(() => getRiskByProcess(toQuery()), [filters]);
  const compliance = useApi(() => getComplianceSummary(toQuery()), [filters]);

  const queueData =
    queue.state.kind === 'ready' && queue.state.result.kind === 'ok'
      ? queue.state.result.data
      : null;
  const procData =
    byProc.state.kind === 'ready' && byProc.state.result.kind === 'ok'
      ? byProc.state.result.data
      : null;
  const compData =
    compliance.state.kind === 'ready' && compliance.state.result.kind === 'ok'
      ? compliance.state.result.data
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Risk"
        title="Risk & Compliance Queue"
        subtitle="High-priority triggers, risk distribution, and compliance evidence."
      />
      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="High-priority triggers"
          icon={<AlertOctagon size={16} />}
          tone="bad"
          loading={compData === null && compliance.state.kind === 'loading'}
          value={fmtInt(compData?.highPriority?.length ?? 0)}
          hint="From compliance summary"
        />
        <KpiCard
          label="Medium flags"
          icon={<ShieldAlert size={16} />}
          tone="warn"
          loading={compData === null && compliance.state.kind === 'loading'}
          value={fmtInt(compData?.medium?.length ?? 0)}
        />
        <KpiCard
          label="Risk queue (page)"
          icon={<AlertOctagon size={16} />}
          tone="bad"
          loading={queue.state.kind === 'loading'}
          value={fmtInt(queueData?.records.length ?? 0)}
          hint={queueData ? `of ${fmtInt(queueData.total)} total` : undefined}
        />
        <KpiCard
          label="Risk by process"
          icon={<AlertOctagon size={16} />}
          tone="info"
          loading={byProc.state.kind === 'loading'}
          value={procData ? fmtInt(procData.rows.length) : '—'}
          hint={procData ? `grouped by ${procData.dimension}` : undefined}
        />
      </section>

      <section className="mb-6">
        <ChartCard
          title="Risk distribution by process"
          subtitle="Stacked: Critical · High · Medium · Safe. Click a process to inspect."
          loading={byProc.state.kind === 'loading'}
          empty={procData ? procData.rows.length === 0 : false}
        >
          {renderByProc(byProc.state, procData, row => {
            if (procData?.dimension === 'process_name') {
              setSelectedProcess(row.process);
              setPage(1);
            }
          })}
        </ChartCard>
      </section>

      <section>
        <ChartCard
          title="Risk queue"
          subtitle={selectedProcess ? `Filtered by process: ${selectedProcess}` : 'Paginated. Click a row for evidence.'}
          loading={queue.state.kind === 'loading'}
          empty={false}
          actions={selectedProcess ? (
            <button
              onClick={() => { setSelectedProcess(null); setPage(1); }}
              className="inline-flex items-center gap-2 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong hover:text-ink-primary"
            >
              <X size={13} />
              Clear process
            </button>
          ) : null}
        >
          {renderQueue(queue.state, queueData, setOpen)}
        </ChartCard>

        {queueData && queueData.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
            <span>Page {queueData.page} of {queueData.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={queueData.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong hover:text-ink-primary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={queueData.page >= queueData.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong hover:text-ink-primary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <EvidenceDrawer record={open} onClose={() => setOpen(null)} />
    </>
  );
}

function renderByProc(
  state: ReturnType<typeof useApi<any>>['state'],
  data: { rows: any[]; dimension: 'category' | 'process_name' } | null,
  onProcessClick: (row: RiskByProcessRow) => void,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    return (
      <RiskByProcessChart
        rows={state.result.data.rows}
        dimension={state.result.data.dimension}
        onProcessClick={onProcessClick}
      />
    );
  }
  return <LoadingSkeleton variant="chart" />;
}

function renderQueue(
  state: ReturnType<typeof useApi<any>>['state'],
  data: { records: RiskQueueRecord[] } | null,
  setOpen: (r: RiskQueueRecord) => void,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok' && data) {
    return <RiskQueueTable records={data.records} onRowClick={setOpen} loading={false} />;
  }
  return <LoadingSkeleton variant="table" rows={6} />;
}

void EmptyState; // keep import used; rendered by table fallback
