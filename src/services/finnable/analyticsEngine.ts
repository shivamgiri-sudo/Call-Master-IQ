/**
 * Finnable Intelligence — Analytics Engine
 * Ported from finnable-dashboard/src/engine/analyticsEngine.js
 * Pure functions — no DB access, no side effects.
 */
import {
  EnrichedCallRow,
  FinnableSummary,
  SalesFunnel,
  CountItem,
  ThemeItem,
  JourneySummary,
  QualitySummary,
  ComplianceSummary,
  LightRecord,
  AnalystProfile,
  ActionQueueItem,
  AgentMappingMap,
  Callout,
  FilterOptions,
} from './types';
import { maskMobile } from './mapper';
import { riskAction, priorityRank } from './riskEngine';

function value(input: unknown): string {
  const text = String(input === null || input === undefined ? '' : input).trim();
  return (!text || /^(none|null|n\/a)$/i.test(text)) ? 'None' : text;
}

function parseDate(val: unknown): Date | null {
  const text = String(val || '').trim();
  if (!text || text === 'None') return null;
  const standard = new Date(text);
  if (!isNaN(standard.getTime())) return standard;
  const m = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!m) return null;
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(year, months[m[2]], Number(m[1]));
}

function sortNewest(a: EnrichedCallRow, b: EnrichedCallRow): number {
  const aDate = parseDate(a.CallDate) || new Date(0);
  const bDate = parseDate(b.CallDate) || new Date(0);
  return bDate.getTime() - aDate.getTime();
}

function averageScore(rows: EnrichedCallRow[]): number {
  const scores = rows.map(r => r.score).filter(v => v !== null) as number[];
  return average(scores);
}

function average(numbers: number[]): number {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((a, b) => a + Number(b), 0) / numbers.length * 10) / 10;
}

function percent(part: number, total: number): number {
  return total ? Math.round(part / total * 1000) / 10 : 0;
}

function unique(values: string[]): string[] {
  const seen: Record<string, boolean> = {};
  values.forEach(v => {
    const val = value(v);
    if (val !== 'None') seen[val] = true;
  });
  return Object.keys(seen).sort();
}

function countByList(rows: EnrichedCallRow[], field: keyof EnrichedCallRow): CountItem[] {
  const counts: Record<string, number> = {};
  rows.forEach(row => {
    const key = value(row[field]);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).map(key => ({ label: key, count: counts[key] }))
    .sort((a, b) => b.count - a.count);
}

function countItem(label: string, count: number): CountItem {
  return { label, count };
}

function parseParameter(context: string, parameter: string): { score: number; max: number } | null {
  const regex = new RegExp('(?:^|\\|)' + parameter + ':(\\d+)\\/(\\d+)', 'i');
  const match = String(context || '').match(regex);
  return match ? { score: Number(match[1]), max: Number(match[2]) } : null;
}

export function lightRecord(row: EnrichedCallRow): LightRecord {
  return {
    id: String(row.id),
    date: row.CallDate,
    analyst: row.AgentName,
    mobile: maskMobile(row.MobileNo),
    callType: row.callType,
    journeyStage: row.journeyStage,
    qualityScore: row.score === null ? 'N/A' : row.score,
    qualityBand: row.qualityBand,
    pitchStrength: row.pitchStrength,
    leakage: row.salesLeakage,
    supportStatus: row.supportStatus,
    riskBucket: row.riskBucket,
    riskLevel: row.Snapmint_Pitch,
    progressed: row.progressed,
    disbursal: row.disbursal,
    actionPriority: row.action.priority,
    actionOwner: row.action.owner,
    actionSla: row.action.sla,
    insight: row.Feedback,
  };
}

export function buildSummary(rows: EnrichedCallRow[]): FinnableSummary {
  const meaningful = rows.filter(r => !r.nonAssessable);
  const scored = rows.filter(r => r.score !== null);
  const opportunities = rows.filter(r => r.opportunity);
  const pitched = opportunities.filter(r => r.PrepaidPitch === '1');
  const salesMixedScored = rows.filter(r => r.opportunity && r.score !== null);
  const supportScored = rows.filter(r => r.callType === 'Support' && r.score !== null);
  const objections = rows.filter(r => r.CustomerObjectionCategory !== 'None');
  return {
    totalCalls: rows.length,
    nonAssessable: rows.filter(r => r.nonAssessable).length,
    meaningfulCalls: meaningful.length,
    qualityScoredCalls: scored.length,
    avgQuality: averageScore(scored),
    salesMixedAvgQuality: averageScore(salesMixedScored),
    supportAvgQuality: averageScore(supportScored),
    opportunities: opportunities.length,
    pitched: pitched.length,
    pitchAttemptRate: percent(pitched.length, opportunities.length),
    strongPitch: opportunities.filter(r => r.pitchStrength === 'Strong').length,
    objections: objections.length,
    objectionHandled: objections.filter(r => r.ObjectionHandling === '1').length,
    highRiskTriggers: rows.filter(r => r.riskBucket === 'High Priority Risk Trigger').length,
    mediumFlags: rows.filter(r => r.riskBucket === 'Medium Transparency / Sensitive Flag').length,
    safeGuidance: rows.filter(r => r.riskBucket === 'Safe / Guided Self-Entry').length,
    disbursalSignal: rows.filter(r => r.disbursal).length,
  };
}

function buildThemes(rows: EnrichedCallRow[]): ThemeItem[] {
  const grouped: Record<string, EnrichedCallRow[]> = {};
  rows.forEach(row => {
    String(row.Product_Appreciation || '').split('|').forEach(theme => {
      const t = value(theme);
      if (t === 'None') return;
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(row);
    });
  });
  return Object.keys(grouped).map(theme => {
    const records = grouped[theme];
    return {
      label: theme,
      count: records.length,
      avgQuality: averageScore(records.filter(r => r.score !== null)),
      progressionRate: percent(records.filter(r => r.progressed).length, records.length),
      riskCount: records.filter(r => ['High Priority Risk Trigger', 'Medium Transparency / Sensitive Flag'].indexOf(r.riskBucket) >= 0).length,
    };
  }).sort((a, b) => b.count - a.count);
}

export function buildSales(rows: EnrichedCallRow[]): SalesFunnel {
  const opportunities = rows.filter(r => r.opportunity);
  return {
    funnel: [
      countItem('Sales / Mixed Opportunities', opportunities.length),
      countItem('Pitch Attempted', opportunities.filter(r => r.PrepaidPitch === '1').length),
      countItem('Strong Pitch', opportunities.filter(r => r.pitchStrength === 'Strong').length),
      countItem('Customer Progressed', opportunities.filter(r => r.progressed).length),
      countItem('Disbursal Signal', opportunities.filter(r => r.disbursal).length),
    ],
    pitchStrength: countByList(opportunities, 'pitchStrength'),
    leakage: countByList(opportunities, 'salesLeakage'),
    pricing: countByList(opportunities, 'Pricing_and_Discount_Structure'),
    objections: countByList(opportunities.filter(r => r.CustomerObjectionSubCategory !== 'None'), 'CustomerObjectionSubCategory'),
    themes: buildThemes(opportunities),
  };
}

export function buildJourney(rows: EnrichedCallRow[]): JourneySummary {
  const pending = rows.filter(r => ['Support Pending', 'Callback Required', 'Escalation Required'].indexOf(r.supportStatus) >= 0);
  return {
    callTypes: countByList(rows, 'callType'),
    stages: countByList(rows.filter(r => r.journeyStage !== 'None'), 'journeyStage'),
    supportStatuses: countByList(rows, 'supportStatus'),
    pendingCount: pending.length,
    pendingCalls: pending.slice().sort(sortNewest).slice(0, 40).map(lightRecord),
  };
}

export function buildQuality(rows: EnrichedCallRow[]): QualitySummary {
  const parameterNames = ['Opening', 'Discovery', 'Pitch', 'Journey', 'Objection', 'Compliance', 'Closing'];
  const params = parameterNames.map(name => {
    const percentages: number[] = [];
    rows.forEach(row => {
      const val = parseParameter(row.FeedbackContext, name);
      if (val) percentages.push((val.score / val.max) * 100);
    });
    return { label: name, average: average(percentages), assessedCalls: percentages.length };
  });
  return {
    bands: countByList(rows, 'qualityBand'),
    byCallType: ['Sales', 'Mixed', 'Support', 'Verification Follow-Up'].map(callType => {
      const records = rows.filter(r => r.callType === callType && r.score !== null);
      return { label: callType, average: averageScore(records), scoredCalls: records.length };
    }),
    parameters: params.sort((a, b) => a.average - b.average),
  };
}

export function buildCompliance(rows: EnrichedCallRow[]): ComplianceSummary {
  const riskRows = rows.filter(r => r.riskBucket !== 'No Risk Flag');
  return {
    buckets: countByList(rows, 'riskBucket'),
    highPriority: riskRows.filter(r => r.riskBucket === 'High Priority Risk Trigger').map(lightRecord),
    medium: riskRows.filter(r => r.riskBucket === 'Medium Transparency / Sensitive Flag').map(lightRecord),
    evidenceQueue: riskRows.slice().sort(sortNewest).map(lightRecord),
  };
}

function buildActions(rows: EnrichedCallRow[], mappings: AgentMappingMap): ActionQueueItem[] {
  return rows.filter(row => row.action.priority !== 'Monitor').map(row => {
    const mapping = mappings[row.AgentName] || {};
    return {
      callId: String(row.id),
      callDate: row.CallDate,
      analyst: row.AgentName,
      tlName: mapping.tlName || 'TL Mapping Required',
      priority: row.action.priority,
      owner: mapping.tlName ? mapping.tlName + ' | ' + row.action.owner : row.action.owner,
      sla: row.action.sla,
      reason: row.action.reason,
      qualityScore: row.score === null ? 'N/A' : row.score,
      callType: row.callType,
      journeyStage: row.journeyStage,
      insight: row.Feedback,
    };
  }).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function buildSingleAnalyst(agent: string, rows: EnrichedCallRow[], mappings: AgentMappingMap): AnalystProfile {
  const s = buildSummary(rows);
  const mapping = mappings[agent] || {};
  const actions = buildActions(rows, mappings);
  const leakage = countByList(rows.filter(r => r.opportunity), 'salesLeakage');
  return {
    agentId: agent,
    analystName: mapping.analystName || agent,
    tlName: mapping.tlName || 'Not Mapped',
    teamName: mapping.teamName || 'Not Mapped',
    calls: rows.length,
    scoredCalls: s.qualityScoredCalls,
    avgQuality: s.avgQuality,
    salesMixedAvgQuality: s.salesMixedAvgQuality,
    opportunities: s.opportunities,
    pitchAttemptRate: s.pitchAttemptRate,
    strongPitch: s.strongPitch,
    highRiskTriggers: s.highRiskTriggers,
    mediumFlags: s.mediumFlags,
    primaryLeakage: leakage.length ? leakage[0].label : 'No Dominant Leakage',
    priority: actions.length ? actions[0].priority : 'Monitor',
  };
}

export function buildAnalysts(rows: EnrichedCallRow[], mappings: AgentMappingMap): AnalystProfile[] {
  const grouped: Record<string, EnrichedCallRow[]> = {};
  rows.forEach(row => {
    if (!grouped[row.AgentName]) grouped[row.AgentName] = [];
    grouped[row.AgentName].push(row);
  });
  return Object.keys(grouped).map(agent => buildSingleAnalyst(agent, grouped[agent], mappings))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.avgQuality - b.avgQuality);
}

export function buildCallouts(summary: FinnableSummary, sales: SalesFunnel, journey: JourneySummary, quality: QualitySummary, compliance: ComplianceSummary, analysts: AnalystProfile[]): Callout[] {
  const output: Callout[] = [];
  output.push({
    severity: 'High',
    title: 'Sales pitch strength is the core capability gap',
    text: `There are ${summary.opportunities} Sales/Mixed opportunities and ${summary.pitched} pitch attempts, but ${summary.strongPitch} defensible strong pitches.`,
  });
  output.push({
    severity: 'High',
    title: 'Overall quality must not mask sales quality',
    text: `Overall average quality is ${summary.avgQuality}, while Sales/Mixed quality is ${summary.salesMixedAvgQuality} compared with Support quality of ${summary.supportAvgQuality}.`,
  });
  output.push({
    severity: 'High',
    title: 'Progression is not final conversion',
    text: `Transcript-confirmed disbursal signals: ${summary.disbursalSignal}. Use operational outcome data for final conversion reporting.`,
  });
  if (summary.highRiskTriggers || summary.mediumFlags) {
    output.push({
      severity: 'Critical',
      title: 'Evidence-based risk actions are pending',
      text: `${summary.highRiskTriggers} high-priority risk triggers and ${summary.mediumFlags} medium transparency/sensitive flags require action.`,
    });
  }
  if (journey.pendingCount) {
    output.push({
      severity: 'Medium',
      title: 'Journey follow-up queue exists',
      text: `${journey.pendingCount} interactions contain pending/callback/escalation support outcomes.`,
    });
  }
  return output;
}

export function buildFilterOptions(rows: EnrichedCallRow[]): FilterOptions {
  return {
    agents: unique(rows.map(r => r.AgentName)),
    callTypes: unique(rows.map(r => r.callType)),
    journeyStages: unique(rows.map(r => r.journeyStage)),
    pitchStrengths: unique(rows.map(r => r.pitchStrength)),
    riskBuckets: unique(rows.map(r => r.riskBucket)),
    actionPriorities: unique(rows.map(r => r.action.priority)),
  };
}

export function insightMatches(row: EnrichedCallRow, dimension: string, value: string): boolean {
  if (!dimension) return true;
  if (dimension === 'risk') return row.riskBucket === value;
  if (dimension === 'leakage') return row.salesLeakage === value;
  if (dimension === 'journey') return row.journeyStage === value;
  if (dimension === 'support') return row.supportStatus === value;
  if (dimension === 'callType') return row.callType === value;
  if (dimension === 'pitch') return row.pitchStrength === value;
  if (dimension === 'qualityBand') return row.qualityBand === value;
  if (dimension === 'qualityType') return row.callType === value;
  if (dimension === 'action') return row.action.priority === value;
  if (dimension === 'funnel') {
    if (value === 'Sales / Mixed Opportunities') return row.opportunity;
    if (value === 'Pitch Attempted') return row.opportunity && row.PrepaidPitch === '1';
    if (value === 'Strong Pitch') return row.opportunity && row.pitchStrength === 'Strong';
    if (value === 'Customer Progressed') return row.opportunity && row.progressed;
    if (value === 'Disbursal Signal') return row.opportunity && row.disbursal;
  }
  return true;
}

export function drilldownTitle(dimension: string, value: string): string {
  if (!dimension) return 'All Filtered Calls';
  const prefixes: Record<string, string> = {
    risk: 'Risk Evidence',
    leakage: 'Sales Leakage Evidence',
    journey: 'Journey Stage Evidence',
    support: 'Support Status Evidence',
    callType: 'Call Type Evidence',
    pitch: 'Pitch Strength Evidence',
    qualityBand: 'Quality Band Evidence',
    qualityType: 'Quality Cohort Evidence',
    action: 'Action Queue Evidence',
    funnel: 'Funnel Stage Evidence',
  };
  return (prefixes[dimension] || 'Evidence') + ': ' + value;
}

// ─── /risk-by-process — Finnable aggregation ────────────────────────────────
//
// Finnable rows do not carry a process_name column. The closest semantic
// dimension in the source data is `Category` (loan/segment type). This
// function groups enriched rows by Category and aggregates the risk signals
// (riskBucket, qualityBand, is_critical_call). The generic adapter path is
// implemented in analyticsExtensionService.ts using v_call_master_unified_kpi
// and the real `process_name` column.

export interface RiskByProcessRow {
  process: string;        // Category for Finnable; process_name for generic
  totalCalls: number;
  criticalCalls: number;  // is_critical_call === 1 OR riskBucket starts with "High"
  highRiskCalls: number;  // riskBucket === "High Priority Risk Trigger"
  mediumRiskCalls: number;
  safeCalls: number;
  averageQuality: number | null;
  topRiskBucket: string;
}

export interface SalesFunnelStage {
  stage: string;
  count: number;
  conversionRateFromPrevious: number | null;
}

export interface SalesFunnelOutput {
  source: 'finnable';
  stages: SalesFunnelStage[];
  totalOpportunities: number;
}

export function buildRiskByProcess(rows: EnrichedCallRow[]): RiskByProcessRow[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byProcess: Record<string, EnrichedCallRow[]> = {};

  for (const row of safeRows) {
    const process = String(row.Category || 'Uncategorised').trim() || 'Uncategorised';
    if (!byProcess[process]) byProcess[process] = [];
    byProcess[process].push(row);
  }

  return Object.entries(byProcess)
    .map(([process, recs]) => {
      const scores = recs.filter(r => r.score !== null).map(r => r.score as number);
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

      const highRisk = recs.filter(r => r.riskBucket === 'High Priority Risk Trigger').length;
      const mediumRisk = recs.filter(r => r.riskBucket === 'Medium Transparency / Sensitive Flag').length;
      const safe = recs.filter(r => r.riskBucket === 'Safe / Guided Self-Entry' || r.riskBucket === 'No Risk Flag').length;
      const critical = recs.filter(r => r.riskBucket === 'High Priority Risk Trigger' || r.riskBucket === 'Medium Transparency / Sensitive Flag').length;

      // Top risk bucket by count
      const bucketCounts: Record<string, number> = {};
      recs.forEach(r => { bucketCounts[r.riskBucket] = (bucketCounts[r.riskBucket] || 0) + 1; });
      const topRiskBucket = Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No Risk Flag';

      return {
        process,
        totalCalls: recs.length,
        criticalCalls: critical,
        highRiskCalls: highRisk,
        mediumRiskCalls: mediumRisk,
        safeCalls: safe,
        averageQuality: avgScore,
        topRiskBucket,
      };
    })
    .sort((a, b) => b.criticalCalls - a.criticalCalls || b.totalCalls - a.totalCalls);
}

// ─── /sales-funnel — Finnable conversion stages ──────────────────────────────
//
// Builds a stage-by-stage funnel from opportunities → pitch → strong pitch
// → progressed → disbursal. Returns the stage counts and conversion rate
// from the previous stage (null for the first stage).
export function buildSalesFunnel(rows: EnrichedCallRow[]): SalesFunnelOutput {
  const safeRows = Array.isArray(rows) ? rows : [];
  const opportunities = safeRows.filter(r => r.opportunity);
  const totalOpportunities = opportunities.length;

  const stageDefs = [
    { stage: 'Sales / Mixed Opportunities', filter: (_r: EnrichedCallRow) => true },
    { stage: 'Pitch Attempted',             filter: (r: EnrichedCallRow) => r.PrepaidPitch === '1' },
    { stage: 'Strong Pitch',                 filter: (r: EnrichedCallRow) => r.pitchStrength === 'Strong' },
    { stage: 'Customer Progressed',          filter: (r: EnrichedCallRow) => r.progressed },
    { stage: 'Disbursal Signal',             filter: (r: EnrichedCallRow) => r.disbursal },
  ];

  let prevCount: number | null = null;
  const stages: SalesFunnelStage[] = stageDefs.map(def => {
    const count = opportunities.filter(def.filter).length;
    const conversion = prevCount && prevCount > 0
      ? Math.round((count / prevCount) * 1000) / 1000
      : null;
    prevCount = count;
    return { stage: def.stage, count, conversionRateFromPrevious: conversion };
  });

  return { source: 'finnable', stages, totalOpportunities };
}

// ─── /parameter-trend — Finnable day-by-day parameter compliance ─────────────
//
// The Finnable source (db_external.CallDetails) carries these parameter-shaped
// columns: PrepaidPitch, ObjectionHandling, UpsellingEfforts, Call_Closing,
// Order_Consent, Further_Assistance, Pricing_and_Discount_Structure,
// Snapmint_Pitch. We define a "passed" predicate per parameter (e.g.
// PrepaidPitch='1', ObjectionHandling='1', UpsellingEfforts='Strong', etc.)
// and aggregate per day. The generic path returns supported:false because
// v_call_master_unified_kpi has no parameter columns.

export interface ParameterDayPoint {
  date: string;
  total: number;
  passed: number;
  passRate: number | null;
}

export interface ParameterTrend {
  parameter: string;
  passedValues: string[];
  series: ParameterDayPoint[];
}

export interface ParameterTrendOutput {
  source: 'finnable';
  parameters: string[];
  trend: ParameterTrend[];
  daysCovered: number;
}

interface ParameterDef {
  name: string;
  // Return the value of this parameter for a row, or null if absent/None.
  read: (row: EnrichedCallRow) => string | null;
  // True if the value counts as a "pass" for this parameter.
  isPassed: (value: string) => boolean;
}

const FINNABLE_PARAMETER_DEFS: ParameterDef[] = [
  {
    name: 'PrepaidPitch',
    read: r => r.PrepaidPitch === '1' ? '1' : (r.PrepaidPitch === '0' ? '0' : null),
    isPassed: v => v === '1',
  },
  {
    name: 'ObjectionHandling',
    read: r => r.ObjectionHandling === '1' ? '1' : (r.ObjectionHandling === '0' ? '0' : null),
    isPassed: v => v === '1',
  },
  {
    name: 'UpsellingEfforts',
    read: r => r.UpsellingEfforts && r.UpsellingEfforts !== 'None' ? r.UpsellingEfforts : null,
    isPassed: v => v === 'Strong',
  },
  {
    name: 'Call_Closing',
    read: r => r.Call_Closing && r.Call_Closing !== 'None' ? r.Call_Closing : null,
    isPassed: v => !['Weak Closing', 'Missing Closing', 'Misleading Closing', 'Call Dropped'].includes(v),
  },
  {
    name: 'Order_Consent',
    read: r => r.Order_Consent === '1' ? '1' : (r.Order_Consent === '0' ? '0' : null),
    isPassed: v => v === '1',
  },
  {
    name: 'Further_Assistance',
    read: r => r.Further_Assistance && r.Further_Assistance !== 'None' ? r.Further_Assistance : null,
    isPassed: v => !['Missing', 'Not Offered'].includes(v),
  },
  {
    name: 'Pricing_and_Discount_Structure',
    read: r => r.Pricing_and_Discount_Structure && r.Pricing_and_Discount_Structure !== 'None' ? r.Pricing_and_Discount_Structure : null,
    isPassed: v => ['Correct', 'Clear', 'Disclosed'].includes(v),
  },
  {
    name: 'Snapmint_Pitch',
    read: r => r.Snapmint_Pitch && r.Snapmint_Pitch !== 'None' ? r.Snapmint_Pitch : null,
    isPassed: v => !['High', 'Critical'].includes(v),
  },
];

export function buildParameterTrend(rows: EnrichedCallRow[]): ParameterTrendOutput {
  const safeRows = Array.isArray(rows) ? rows : [];

  // Bucket rows by date (yyyy-mm-dd prefix)
  const byDate: Record<string, EnrichedCallRow[]> = {};
  for (const row of safeRows) {
    const date = String(row.CallDate || '').slice(0, 10);
    if (!date || date === 'null') continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(row);
  }
  const days = Object.keys(byDate).sort();

  const trend: ParameterTrend[] = FINNABLE_PARAMETER_DEFS.map(def => {
    const series: ParameterDayPoint[] = days.map(date => {
      const dayRows = byDate[date] || [];
      let total = 0;
      let passed = 0;
      for (const row of dayRows) {
        const v = def.read(row);
        if (v === null) continue;
        total++;
        if (def.isPassed(v)) passed++;
      }
      return {
        date,
        total,
        passed,
        passRate: total > 0 ? Math.round((passed / total) * 1000) / 1000 : null,
      };
    });

    return {
      parameter: def.name,
      passedValues: [],
      series,
    };
  });

  return {
    source: 'finnable',
    parameters: trend.map(t => t.parameter),
    trend,
    daysCovered: days.length,
  };
}
