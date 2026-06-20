/**
 * Semantic color helpers — single source of truth for which color means what.
 *
 * Maps a label / value to a semantic Tailwind class for chips, badges, and
 * chart series. Centralised here so the UI stays consistent and re-skinnable.
 */

import type { QualityBand, RiskBucket } from './qualityBuckets';

export function qualityBandClass(band: string | undefined): string {
  switch (band) {
    case 'Excellent':
      return 'pill pill-good';
    case 'Good':
      return 'pill pill-info';
    case 'Improvement Required':
      return 'pill pill-warn';
    case 'High Risk':
      return 'pill pill-bad';
    case 'Critical Coaching':
      return 'pill pill-bad';
    case 'Non-Assessable':
      return 'pill';
    case 'Limited Evidence':
      return 'pill';
    default:
      return 'pill';
  }
}

export function riskBucketClass(bucket: string | undefined): string {
  switch (bucket) {
    case 'High Priority Risk Trigger':
      return 'pill pill-bad';
    case 'Medium Transparency / Sensitive Flag':
      return 'pill pill-warn';
    case 'Safe / Guided Self-Entry':
      return 'pill pill-good';
    default:
      return 'pill';
  }
}

export function priorityClass(priority: string | undefined): string {
  if (!priority) return 'pill';
  if (priority.startsWith('P1')) return 'pill pill-bad';
  if (priority.startsWith('P2')) return 'pill pill-warn';
  if (priority.startsWith('P3')) return 'pill pill-info';
  return 'pill';
}

export function sourceClass(source: string | undefined): string {
  if (source === 'finnable') return 'pill pill-violet';
  if (source === 'generic') return 'pill pill-info';
  return 'pill';
}

// ─── Chart palette — semantic mapping for Recharts series ──────────────────
export const CHART_PALETTE = {
  good: '#34D399',
  warn: '#FBBF24',
  bad: '#F87171',
  blue: '#5B9BFF',
  cyan: '#38E1FF',
  violet: '#9D7BFF',
  ink: '#B6BCCB',
  muted: '#6F7787',
} as const;

export const SERIES_COLORS = [
  CHART_PALETTE.violet,
  CHART_PALETTE.blue,
  CHART_PALETTE.cyan,
  CHART_PALETTE.good,
  CHART_PALETTE.warn,
  CHART_PALETTE.bad,
] as const;

// Type re-export to avoid breaking import sites
export type { QualityBand, RiskBucket };