import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import type { TopBottomAgentsData } from '../../api/types';
import { fmtDate, fmtDec, fmtInt } from '../../utils/formatters';
import EmptyState from '../states/EmptyState';

interface AnalystTableProps {
  analysts: TopBottomAgentsData['analysts'];
  loading?: boolean;
  onRowClick?: (a: TopBottomAgentsData['analysts'][number]) => void;
}

type SortKey = 'avgScore' | 'totalCalls' | 'highRiskCount' | 'opportunities' | 'agentName';

export default function AnalystTable({ analysts, loading, onRowClick }: AnalystTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('avgScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return analysts;
    return analysts.filter(a => (a.agentName || '').toLowerCase().includes(q));
  }, [analysts, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'agentName' ? 'asc' : 'asc'); }
  };

  if (!loading && analysts.length === 0) {
    return <EmptyState title="No analysts" description="No analyst records in the selected window." />;
  }

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search analysts…"
            className="w-full rounded-lg border border-line-subtle bg-elevated/40 py-2 pl-9 pr-3 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-violet/40 focus-ring"
          />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">{sorted.length} analyst{sorted.length === 1 ? '' : 's'}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-line-subtle bg-elevated/30 text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <Th label="Analyst" onClick={() => onSort('agentName')} active={sortKey === 'agentName'} dir={sortDir} />
              <Th label="Avg score" onClick={() => onSort('avgScore')} active={sortKey === 'avgScore'} dir={sortDir} numeric />
              <Th label="Calls" onClick={() => onSort('totalCalls')} active={sortKey === 'totalCalls'} dir={sortDir} numeric />
              <Th label="High risk" onClick={() => onSort('highRiskCount')} active={sortKey === 'highRiskCount'} dir={sortDir} numeric />
              <Th label="Opportunities" onClick={() => onSort('opportunities')} active={sortKey === 'opportunities'} dir={sortDir} numeric />
              <th className="px-4 py-3 text-right">Last call</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, index) => (
              <tr
                key={`${a.agentName || 'unknown'}-${a.lastCallDate || 'no-date'}-${index}`}
                onClick={() => onRowClick?.(a)}
                className="cursor-pointer border-b border-line-subtle/60 text-sm text-ink-secondary transition-colors hover:bg-elevated/40"
              >
                <td className="px-4 py-3 font-medium text-ink-primary">{a.agentName}</td>
                <td className={`px-4 py-3 text-right font-semibold ${scoreTone(a.avgScore)}`}>
                  {a.avgScore === null || a.avgScore === undefined ? '—' : fmtDec(a.avgScore, 1)}
                </td>
                <td className="px-4 py-3 text-right">{fmtInt(a.totalCalls)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={a.highRiskCount && a.highRiskCount > 0 ? 'text-bad' : 'text-ink-muted'}>
                    {fmtInt(a.highRiskCount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{fmtInt(a.opportunities)}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{fmtDate(a.lastCallDate)}</td>
              </tr>
            ))}
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-b border-line-subtle/60">
                {Array.from({ length: 6 }).map((__, j) => (
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

function Th({
  label,
  onClick,
  active,
  dir,
  numeric,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  dir?: 'asc' | 'desc';
  numeric?: boolean;
}) {
  return (
    <th className={`px-4 py-3 ${numeric ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider transition-colors ${
          numeric ? 'ml-auto flex' : ''
        } text-ink-muted hover:text-ink-primary`}
      >
        {label}
        <ArrowUpDown size={11} className={active ? 'text-violet' : 'opacity-50'} />
        {active && dir ? <span className="text-violet">{dir === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
    </th>
  );
}

function scoreTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-ink-muted';
  if (score >= 85) return 'text-good';
  if (score >= 70) return 'text-warn';
  return 'text-bad';
}
