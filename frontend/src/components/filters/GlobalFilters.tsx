import { useEffect, useState } from 'react';
import { Database, RotateCcw } from 'lucide-react';
import { getFilterOptions } from '../../api/analyticsApi';
import type { FilterOption, FilterOptionsData } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '../../context/FiltersContext';
import { getUserRole } from '../../routes/roleMap';
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
  const { user } = useAuth();
  const role = getUserRole(user);
  const { filters, setFilter, setFilters, resetFilters } = useFilters();
  const [options, setOptions] = useState<FilterOptionsData | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const branchLocked = role === 'BRANCH_MANAGER' && Boolean(user?.branch_short_name);
  const processLocked = role === 'PROCESS_MANAGER' && Boolean(user?.process_name);
  const teamLocked = role === 'TEAM_LEADER' && Boolean(user?.team_id);
  const selfLocked = role === 'ANALYST' && Boolean(user?.employee_code || user?.user_id || user?.id);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions().then(result => {
      if (cancelled) return;
      if (result.kind === 'ok') {
        setOptions(result.data);
        setOptionsError(null);
      } else if (result.kind === 'error') {
        setOptionsError(result.message);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const locked: Record<string, string> = {};
    if (branchLocked && user?.branch_short_name) locked.branch_short_name = String(user.branch_short_name);
    if (processLocked && user?.process_name) locked.process_name = String(user.process_name);
    if (teamLocked && user?.team_id) locked.team_id = String(user.team_id);
    if (selfLocked) locked.analyst_id = String(user?.employee_code || user?.user_id || user?.id || '');
    if (Object.keys(locked).length) setFilters(locked);
  }, [branchLocked, processLocked, teamLocked, selfLocked, user, setFilters]);

  const resetScopedFilters = () => {
    resetFilters();
    const locked: Record<string, string> = {};
    if (branchLocked && user?.branch_short_name) locked.branch_short_name = String(user.branch_short_name);
    if (processLocked && user?.process_name) locked.process_name = String(user.process_name);
    if (teamLocked && user?.team_id) locked.team_id = String(user.team_id);
    if (selfLocked) locked.analyst_id = String(user?.employee_code || user?.user_id || user?.id || '');
    if (Object.keys(locked).length) setFilters(locked);
  };

  return (
    <div className="mb-6 rounded-lg border border-line-subtle bg-panel/75 p-4 shadow-glass backdrop-blur-glass">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Database size={14} className="text-blue" />
          <span className="font-medium uppercase tracking-wider">Live Call Master Filters</span>
          <span className="rounded-full border border-line-subtle bg-elevated/40 px-2 py-0.5 text-[10px] text-ink-secondary">{role}</span>
          {optionsError ? <span className="text-warn">Options unavailable, manual entry enabled</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Client</label>
        {options?.clients.length ? (
          <SelectBox
            value={filters.client_id}
            onChange={value => setFilter('client_id', value)}
            options={options.clients}
            className="w-44"
            includeAll={false}
          />
        ) : (
          <InputBox value={filters.client_id} onChange={value => setFilter('client_id', value)} className="w-28" placeholder="e.g. 497" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Process</label>
        {options?.processes.length ? (
          <SelectBox value={filters.process_name} onChange={value => setFilter('process_name', value)} options={options.processes} className="w-52" disabled={processLocked} />
        ) : (
          <InputBox value={filters.process_name} onChange={value => setFilter('process_name', value)} className="w-40" placeholder="Any process" disabled={processLocked} />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Business LOB</label>
        {options?.businessLobs.length ? (
          <SelectBox value={filters.business_lob} onChange={value => setFilter('business_lob', value)} options={options.businessLobs} className="w-44" />
        ) : (
          <InputBox value={filters.business_lob} onChange={value => setFilter('business_lob', value)} className="w-32" placeholder="Any LOB" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Branch</label>
        {options?.branches.length ? (
          <SelectBox value={filters.branch_short_name} onChange={value => setFilter('branch_short_name', value)} options={options.branches} className="w-44" disabled={branchLocked} />
        ) : (
          <InputBox value={filters.branch_short_name} onChange={value => setFilter('branch_short_name', value)} className="w-32" placeholder="Any branch" disabled={branchLocked} />
        )}
      </div>

      {teamLocked || selfLocked ? (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-ink-muted">{selfLocked ? 'Analyst' : 'Team'}</label>
          <InputBox
            value={selfLocked ? filters.analyst_id : filters.team_id}
            onChange={value => setFilter(selfLocked ? 'analyst_id' : 'team_id', value)}
            className="w-36"
            placeholder={selfLocked ? 'Self' : 'Team'}
            disabled
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-muted">Source</label>
        <SelectBox
          value={filters.source_type}
          onChange={value => setFilter('source_type', value)}
          options={options?.sources.length ? options.sources : [
            { value: 'Inbound', label: 'Inbound', count: 0 },
            { value: 'Outbound', label: 'Outbound', count: 0 },
          ]}
          className="w-36"
        />
      </div>

      <div className="ml-auto flex items-end gap-3">
        <DateRangePicker />
        <button
          onClick={resetScopedFilters}
          className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
          title="Reset filters"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
      </div>
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  className,
  includeAll = true,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className: string;
  includeAll?: boolean;
  disabled?: boolean;
}) {
  const hasCurrent = !value || options.some(option => option.value === value);
  return (
    <select
      value={hasCurrent ? value : ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`${className} rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {includeAll ? <option value="">All</option> : null}
      {!hasCurrent && value ? <option value={value}>{value}</option> : null}
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}{option.count ? ` (${option.count})` : ''}
        </option>
      ))}
    </select>
  );
}

function InputBox({
  value,
  onChange,
  className,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`${className} rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring disabled:cursor-not-allowed disabled:opacity-60`}
      placeholder={placeholder}
    />
  );
}
