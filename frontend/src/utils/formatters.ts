/**
 * formatters.ts — compact number / date / percentage formatting.
 *
 * All output is plain strings. No DOM, no Intl side-effects beyond the
 * singleton Intl.NumberFormat / Intl.DateTimeFormat instances below.
 */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const pf0 = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });
const pf1 = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export function fmtInt(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? nf0.format(v) : '—';
}

export function fmtDec(n: unknown, digits = 1): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return digits === 0 ? nf0.format(v) : digits === 1 ? nf1.format(v) : nf2.format(v);
}

export function fmtPct(ratio: unknown, digits = 0): string {
  const v = Number(ratio);
  if (!Number.isFinite(v)) return '—';
  return digits === 0 ? pf0.format(v) : pf1.format(v);
}

export function fmtPercentFromCount(numerator: number, denominator: number): string {
  if (!denominator || !Number.isFinite(denominator)) return '—';
  return fmtPct(numerator / denominator);
}

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtDate(input: unknown): string {
  if (!input) return '—';
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return String(input);
  return dateFmt.format(d);
}

export function fmtDateTime(input: unknown): string {
  if (!input) return '—';
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return String(input);
  return dateTimeFmt.format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the difference between two ISO date strings as days.
 * Returns null if inputs invalid.
 */
export function diffDays(fromIso: string, toIso: string): number | null {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function clampText(s: string, max = 80): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

export function shortId(id: unknown, len = 8): string {
  const s = String(id ?? '');
  if (!s) return '—';
  return s.length <= len ? s : s.slice(0, len);
}