// src/callmaster/repositories/baseRepository.ts

export type Preset = 'MTD' | 'WTD' | 'D1';

export interface DateRange {
  startDate: string;  // 'YYYY-MM-DD'
  endDate: string;
}

export function presetToDateRange(preset: Preset): DateRange {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const today = fmt(now);

  if (preset === 'D1') {
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 1);
    const d1s = fmt(d1);
    return { startDate: d1s, endDate: d1s };
  }

  if (preset === 'WTD') {
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return { startDate: fmt(monday), endDate: today };
  }

  // MTD
  return {
    startDate: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`,
    endDate: today,
  };
}

export interface PaginationParams {
  page: number;   // 1-indexed
  limit: number;
}

export function paginationClause(p: PaginationParams): string {
  const offset = (p.page - 1) * p.limit;
  return `LIMIT ${p.limit} OFFSET ${offset}`;
}

export function safeScopeFilter(
  field: string,
  values: string[]
): { clause: string; params: string[] } {
  if (values.includes('*') || values.length === 0) {
    return { clause: '1=1', params: [] };
  }
  const placeholders = values.map(() => '?').join(',');
  return { clause: `${field} IN (${placeholders})`, params: values };
}
