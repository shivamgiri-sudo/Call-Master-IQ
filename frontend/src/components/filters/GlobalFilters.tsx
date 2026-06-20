import { RotateCcw } from 'lucide-react';
import { useFilters } from '../../context/FiltersContext';
import DateRangePicker from './DateRangePicker';

/**
 * GlobalFilters — global filter strip rendered inside pages.
 *
 * Five selectors (client / process / business_lob / branch / source_type)
 * + a date range picker + a reset button. All bound to FiltersContext.
 *
 * No mock option lists: the option lists intentionally come from the API
 * (FilterOptions endpoint) — when not loaded, the selectors default to a
 * free-text input mode so the user can still type a value.
 */
export default function GlobalFilters() {
  const { filters, setFilter, resetFilters } = useFilters();

  return (
    <div className="glass mb-6 flex flex-wrap items-center gap-3 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Client</label>
        <input
          value={filters.client_id}
          onChange={e => setFilter('client_id', e.target.value)}
          className="w-28 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
          placeholder="e.g. 497"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Process</label>
        <input
          value={filters.process_name}
          onChange={e => setFilter('process_name', e.target.value)}
          className="w-40 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
          placeholder="Any process"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Business LOB</label>
        <input
          value={filters.business_lob}
          onChange={e => setFilter('business_lob', e.target.value)}
          className="w-32 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
          placeholder="Any LOB"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Branch</label>
        <input
          value={filters.branch_short_name}
          onChange={e => setFilter('branch_short_name', e.target.value)}
          className="w-32 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
          placeholder="Any branch"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Source</label>
        <select
          value={filters.source_type}
          onChange={e => setFilter('source_type', e.target.value)}
          className="w-32 rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
        >
          <option value="">All</option>
          <option value="Inbound">Inbound</option>
          <option value="Outbound">Outbound</option>
          <option value="Chat">Chat</option>
          <option value="Email">Email</option>
        </select>
      </div>

      <div className="ml-auto flex items-end gap-3">
        <DateRangePicker />
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
          title="Reset filters"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  );
}