/**
 * FiltersContext — global filter state shared across all pages.
 *
 * The default client_id is '497' (the Finnable client per
 * src/services/finnable/types.ts:DEFAULT_CLIENT_ID). Default date range is
 * the last 30 days, matching the smoke script convention.
 */

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { daysAgoIso, todayIso } from '../utils/formatters';

export interface GlobalFilters {
  client_id: string;
  process_name: string;
  business_lob: string;
  branch_short_name: string;
  source_type: string;
  analyst_id: string;
  team_id: string;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: GlobalFilters = {
  client_id: '497',
  process_name: '',
  business_lob: '',
  branch_short_name: '',
  source_type: '',
  analyst_id: '',
  team_id: '',
  from: daysAgoIso(30),
  to: todayIso(),
};

interface FiltersState {
  filters: GlobalFilters;
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  setFilters: (next: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  toQuery: () => Record<string, string>;
}

const FiltersContext = createContext<FiltersState | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersRaw] = useState<GlobalFilters>(DEFAULT_FILTERS);

  const setFilter = useCallback(<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
    setFiltersRaw(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((next: Partial<GlobalFilters>) => {
    setFiltersRaw(prev => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw(DEFAULT_FILTERS);
  }, []);

  const toQuery = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {
      client_id: filters.client_id,
      from: filters.from,
      to: filters.to,
    };
    if (filters.process_name) out.process_name = filters.process_name;
    if (filters.business_lob) out.business_lob = filters.business_lob;
    if (filters.branch_short_name) out.branch_short_name = filters.branch_short_name;
    if (filters.source_type) out.source_type = filters.source_type;
    if (filters.analyst_id) out.analyst_id = filters.analyst_id;
    if (filters.team_id) out.team_id = filters.team_id;
    return out;
  }, [filters]);

  const value = useMemo<FiltersState>(() => ({
    filters,
    setFilter,
    setFilters,
    resetFilters,
    toQuery,
  }), [filters, setFilter, setFilters, resetFilters, toQuery]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersState {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
