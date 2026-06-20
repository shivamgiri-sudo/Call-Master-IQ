/**
 * Finnable Intelligence — Trend Engine
 * Ported from finnable-dashboard/src/engine/trendEngine.js
 * Pure functions — no DB access, no side effects.
 */
import { DayTrendItem, ScoreBandItem } from './types';

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDateRange(preset: string): { from: string; to: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === 'D1') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { from: fmtDate(d), to: fmtDate(d) };
  }
  if (preset === 'WTD') {
    const mon = new Date(today);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    return { from: fmtDate(mon), to: fmtDate(today) };
  }
  if (preset === 'MTD') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmtDate(first), to: fmtDate(today) };
  }
  return null;
}

export function scoreband(score: unknown): string {
  const s = Number(score);
  if (isNaN(s) || score === null || score === '') return 'Unscored';
  if (s >= 90) return 'Excellent (90+)';
  if (s >= 80) return 'On Target (80-89)';
  if (s >= 70) return 'Below Target (70-79)';
  if (s > 0) return 'High Risk (<70)';
  return 'Zero Score';
}

export function buildDayTrend(rows: any[]): DayTrendItem[] {
  const byDate: Record<string, { date: string; scores: number[]; total: number; pitchAttempts: number; highRisk: number }> = {};
  (rows || []).forEach(r => {
    const d = String(r.CallDate || '').slice(0, 10);
    if (!d || d === 'null') return;
    if (!byDate[d]) byDate[d] = { date: d, scores: [], total: 0, pitchAttempts: 0, highRisk: 0 };
    byDate[d].total++;
    const score = Number(r.Feedback_Category);
    if (!isNaN(score) && score > 0) byDate[d].scores.push(score);
    if (r.PrepaidPitch === '1') byDate[d].pitchAttempts++;
    if (['High', 'Critical'].includes(String(r.Snapmint_Pitch || ''))) byDate[d].highRisk++;
  });
  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: d.date,
      avgScore: d.scores.length
        ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length * 10) / 10
        : null,
      totalCalls: d.total,
      scoredCalls: d.scores.length,
      pitchAttempts: d.pitchAttempts,
      highRiskCount: d.highRisk,
    }));
}

export function buildScoreBands(rows: any[]): ScoreBandItem[] {
  const bands: Record<string, number> = {};
  (rows || []).forEach(r => {
    const band = scoreband(r.Feedback_Category);
    bands[band] = (bands[band] || 0) + 1;
  });
  const order = ['Excellent (90+)', 'On Target (80-89)', 'Below Target (70-79)', 'High Risk (<70)', 'Zero Score', 'Unscored'];
  return order.filter(k => bands[k]).map(label => ({ label, count: bands[label] }));
}
