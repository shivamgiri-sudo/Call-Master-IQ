import { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import type { RiskQueueRecord } from '../../api/types';
import { fmtDate, fmtDec } from '../../utils/formatters';
import { priorityClass, qualityBandClass, riskBucketClass } from '../../utils/colors';
import EmptyState from '../states/EmptyState';
import { downloadCsv, toCsv } from '../../utils/safeExport';

interface RiskQueueTableProps {
  records: RiskQueueRecord[];
  loading?: boolean;
  onRowClick?: (rec: RiskQueueRecord) => void;
}

type SortKey = 'date' | 'analyst' | 'riskBucket' | 'qualityScore' | 'actionPriority';

export default function RiskQueueTable({ records, loading, onRowClick }: RiskQueueTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      [r.id, r.analyst, r.riskBucket, r.qualityBand, r.actionPriority, r.insight]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    );
  }, [records, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === bv) return 0;
      if (av === undefined || av === null || av === '') return 1;
      if (bv === undefined || bv === null || bv === '') return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const exportVisible = () => {
    const csv = toCsv(sorted.map(r => ({
      id: r.id,
      date: r.date,
      analyst: r.analyst,
      callType: r.callType,
      journeyStage: r.journeyStage,
      riskBucket: r.riskBucket,
      riskLevel: r.riskLevel,
      qualityScore: r.qualityScore,
      qualityBand: r.qualityBand,
      pitchStrength: r.pitchStrength,
      leakage: r.leakage,
      supportStatus: r.supportStatus,
      actionPriority: r.actionPriority,
      actionSla: r.actionSla,
      actionOwner: r.actionOwner,
    })), [
      { key: 'id', label: 'Call ID' },
      { key: 'date', label: 'Date' },
      { key: 'analyst', label: 'Analyst' },
      { key: 'callType', label: 'Call type' },
      { key: 'journeyStage', label: 'Journey stage' },
      { key: 'riskBucket', label: 'Risk bucket' },
      { key: 'riskLevel', label: 'Risk level' },
      { key: 'qualityScore', label: 'Quality score' },
      { key: 'qualityBand', label: 'Quality band' },
      { key: 'pitchStrength', label: 'Pitch strength' },
      { key: 'leakage', label: 'Leakage' },
      { key: 'supportStatus', label: 'Support status' },
      { key: 'actionPriority', label: 'Action priority' },
      { key: 'actionSla', label: 'Action SLA' },
      { key: 'actionOwner', label: 'Action owner' },
    ]);
    downloadCsv('call-master-risk-visible.csv', csv);
  };

  if (!loading && records.length === 0) {
    return <EmptyState title="No risk records" description="No high-priority risk triggers in the selected window." />;
  }

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search risk queue…"
            className="w-full rounded-lg border border-line-subtle bg-elevated/40 py-2 pl-9 pr-3 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-violet/40 focus-ring"
          />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          {sorted.length} record{sorted.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={exportVisible}
          disabled={sorted.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary disabled:opacity-40"
        >
          <Download size={13} />
          CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-line-subtle bg-elevated/30 text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <Th label="Date" onClick={() => onSort('date')} active={sortKey === 'date'} dir={sortDir} />
              <Th label="Analyst" onClick={() => onSort('analyst')} active={sortKey === 'analyst'} dir={sortDir} />
              <Th label="Risk" onClick={() => onSort('riskBucket')} active={sortKey === 'riskBucket'} dir={sortDir} />
              <Th label="Quality" onClick={() => onSort('qualityScore')} active={sortKey === 'qualityScore'} dir={sortDir} />
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr
                key={r.id}
                onClick={() => onRowClick?.(r)}
                className={`cursor-pointer border-b border-line-subtle/60 text-sm text-ink-secondary transition-colors hover:bg-elevated/40 ${onRowClick ? '' : 'cursor-default'}`}
              >
                <td className="px-4 py-3 text-ink-primary">{fmtDate(r.date)}</td>
                <td className="px-4 py-3">{r.analyst || '—'}</td>
                <td className="px-4 py-3">
                  <span className={riskBucketClass(r.riskBucket)}>{r.riskBucket || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={qualityBandClass(String(r.qualityBand))}>
                    {r.qualityScore === 'N/A' || r.qualityScore === null || r.qualityScore === undefined
                      ? '—'
                      : `${fmtDec(r.qualityScore, 1)} · ${r.qualityBand || ''}`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={priorityClass(r.actionPriority)}>{r.actionPriority || '—'}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{r.actionSla || '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{r.actionOwner || '—'}</td>
              </tr>
            ))}
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-b border-line-subtle/60">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="skeleton h-4 w-3/4" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, onClick, active, dir }: { label: string; onClick?: () => void; active?: boolean; dir?: 'asc' | 'desc' }) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-muted transition-colors hover:text-ink-primary"
      >
        {label}
        <ArrowUpDown size={11} className={active ? 'text-violet' : 'opacity-50'} />
        {active && dir ? (
          <span className="text-violet">{dir === 'asc' ? '↑' : '↓'}</span>
        ) : null}
      </button>
    </th>
  );
}
