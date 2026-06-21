import { useState } from 'react';
import { ClipboardCopy, Search, ListFilter } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import ChartCard from '../components/charts/ChartCard';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import ErrorState from '../components/states/ErrorState';
import EmptyState from '../components/states/EmptyState';
import UnsupportedState from '../components/states/UnsupportedState';
import RiskQueueTable from '../components/tables/RiskQueueTable';
import EvidenceDrawer from '../components/evidence/EvidenceDrawer';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { postDrilldown, getRiskQueue, getSensitiveWords } from '../api/analyticsApi';
import type { RiskQueueRecord } from '../api/types';
import { copySafeText } from '../utils/safeExport';

const DIMENSIONS: Array<{ value: string; label: string }> = [
  { value: 'risk', label: 'Risk bucket' },
  { value: 'journey', label: 'Journey stage' },
  { value: 'support', label: 'Support status' },
  { value: 'callType', label: 'Call type' },
  { value: 'pitch', label: 'Pitch strength' },
  { value: 'qualityBand', label: 'Quality band' },
  { value: 'qualityType', label: 'Quality cohort' },
  { value: 'funnel', label: 'Funnel stage' },
];

export default function EvidenceDrilldown() {
  const { filters, toQuery } = useFilters();
  const [searchParams] = useSearchParams();
  const [dimension, setDimension] = useState(searchParams.get('dimension') || DIMENSIONS[0].value);
  const [value, setValue] = useState(searchParams.get('value') || 'High Priority Risk Trigger');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [open, setOpen] = useState<RiskQueueRecord | null>(null);

  const drill = useApi(
    () => postDrilldown({ dimension, value, ...toQuery(), page, limit }),
    [filters, dimension, value, page],
  );
  const fallback = useApi(() => getRiskQueue({ ...toQuery(), page: 1, limit: limit }), [filters]);
  const sensitive = useApi(() => getSensitiveWords(toQuery()), [filters]);

  const drillData = drill.state.kind === 'ready' && drill.state.result.kind === 'ok' ? drill.state.result.data : null;
  const fbData = fallback.state.kind === 'ready' && fallback.state.result.kind === 'ok' ? fallback.state.result.data : null;
  const sensitiveData = sensitive.state.kind === 'ready' && sensitive.state.result.kind === 'ok' ? sensitive.state.result.data : null;
  const copyRiskSummary = () => {
    copySafeText([
      'Call Master IQ Risk Summary',
      `Dimension: ${dimension}`,
      `Value: ${value}`,
      `Matching records: ${drillData?.total ?? 'not returned'}`,
      `Fallback queue total: ${fbData?.total ?? 'not returned'}`,
      `Sensitive incidents: ${sensitiveData?.totalIncidents ?? 'not returned'}`,
      sensitiveData?.byTerm?.[0]?.term ? `Top sensitive term: ${sensitiveData.byTerm[0].term}` : 'Top sensitive term: not returned',
    ].join('\n'));
  };

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Evidence Drilldown"
        subtitle="Filter the call list by any insight dimension. Snippets only — never raw transcripts."
        actions={(
          <button
            onClick={copyRiskSummary}
            className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
          >
            <ClipboardCopy size={14} />
            Copy risk summary
          </button>
        )}
      />
      <GlobalFilters />

      <section className="glass mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-ink-muted">Dimension</label>
            <select
              value={dimension}
              onChange={e => setDimension(e.target.value)}
              className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-2 text-sm text-ink-primary focus-ring"
            >
              {DIMENSIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-ink-muted">Value</label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full rounded-lg border border-line-subtle bg-elevated/40 py-2 pl-9 pr-3 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
                placeholder="e.g. High Priority Risk Trigger"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setPage(1); drill.reload(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/15 px-3 py-2 text-xs font-medium text-violet transition-colors hover:bg-violet/20 focus-ring"
            >
              <ListFilter size={14} />
              Apply
            </button>
          </div>
        </div>
      </section>

      <ChartCard
        title={drillData?.title || `Filter results: ${dimension} = ${value}`}
        subtitle={drillData ? `${drillData.total} records · page ${drillData.page} / ${Math.max(1, Math.ceil(drillData.total / drillData.limit))}` : 'Run a filter to see matching calls.'}
        loading={drill.state.kind === 'loading'}
        empty={false}
      >
        {renderDrill(drill.state, drillData, setOpen)}
      </ChartCard>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Fallback queue</div>
          <div className="mt-2 text-2xl font-semibold text-ink-primary">{fbData?.total ?? '—'}</div>
          <p className="mt-1 text-xs text-ink-muted">Risk records available for selected filters.</p>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Sensitive incidents</div>
          <div className="mt-2 text-2xl font-semibold text-warn">{sensitiveData?.totalIncidents ?? '—'}</div>
          <p className="mt-1 text-xs text-ink-muted">From masked sensitive-word contexts.</p>
        </div>
        <div className="glass p-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Top term</div>
          <div className="mt-2 truncate text-lg font-semibold text-ink-primary">{sensitiveData?.byTerm?.[0]?.term ?? '—'}</div>
          <p className="mt-1 text-xs text-ink-muted">{sensitiveData?.byTerm?.[0]?.count ? `${sensitiveData.byTerm[0].count} hits` : 'No sensitive term data returned.'}</p>
        </div>
      </section>

      {drillData && Math.ceil(drillData.total / drillData.limit) > 1 ? (
        <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
          <span>Page {drillData.page} of {Math.max(1, Math.ceil(drillData.total / drillData.limit))}</span>
          <div className="flex gap-2">
            <button
              disabled={drillData.page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={drillData.page * drillData.limit >= drillData.total}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <EvidenceDrawer record={open} onClose={() => setOpen(null)} />
    </>
  );
}

function renderDrill(
  state: ReturnType<typeof useApi<any>>['state'],
  data: { records: RiskQueueRecord[]; title: string; total: number } | null,
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

void EmptyState;
