/**
 * Finnable Intelligence Module — Row Enrichment Mapper
 * Ported from finnable-dashboard/src/engine/analyticsEngine.js enrich_() logic.
 * Pure functions — no DB access, no side effects.
 */
import {
  RawCallRow,
  EnrichedCallRow,
  QualityBand,
  RiskBucket,
  SalesLeakage,
  ActionItem,
} from './types';

function value(input: unknown): string {
  const text = String(input === null || input === undefined ? '' : input).trim();
  return (!text || /^(none|null|n\/a)$/i.test(text)) ? 'None' : text;
}

function numeric(val: unknown): number | null {
  const text = String(val || '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

function scoreFromContext(feedbackContext: string): number | null {
  const text = String(feedbackContext || '');
  if (!text || /Non-Assessable/i.test(text)) return null;
  const match = text.match(/Total:(\d+)(?:\/(\d+))?/i);
  if (!match) return null;
  const num = Number(match[1]);
  const denom = match[2] ? Number(match[2]) : null;
  if (denom && denom > 0) return Math.round(num / denom * 100);
  if (num >= 0 && num <= 100) return num;
  return null;
}

function qualityBand(row: { nonAssessable: boolean; score: number | null }): QualityBand {
  if (row.nonAssessable) return 'Non-Assessable';
  if (row.score === null) return 'Limited Evidence';
  if (row.score >= 90) return 'Excellent';
  if (row.score >= 80) return 'Good';
  if (row.score >= 70) return 'Improvement Required';
  if (row.score >= 60) return 'High Risk';
  return 'Critical Coaching';
}

function riskBucket(row: RawCallRow): RiskBucket {
  if (row.Snapmint_Pitch === 'High' || row.Snapmint_Pitch === 'Critical') return 'High Priority Risk Trigger';
  if (row.Snapmint_Pitch === 'Medium') return 'Medium Transparency / Sensitive Flag';
  if (/Self-Entry Guidance|Safe OTP/i.test(String(row.SensitiveWordUsed || ''))) return 'Safe / Guided Self-Entry';
  return 'No Risk Flag';
}

const PROGRESSED_DISPOSITIONS = [
  'Interested_Need loan',
  'Interested But Pending',
  'Application In Progress',
  'Application Completed - Verification Pending',
  'Customer Agreed To Proceed',
  'Disbursed - Transcript Confirmed',
];

function salesLeakage(row: EnrichedCallRow): SalesLeakage {
  if (!row.opportunity) return 'Not Applicable';
  if (row.PrepaidPitch !== '1') return 'No Pitch Attempted';
  if (row.pitchStrength === 'Weak') return 'Weak Pitch';
  if (['Potentially Misleading', 'Incorrect or Unsafe', 'Partial Disclosure', 'Not Discussed']
    .indexOf(row.Pricing_and_Discount_Structure) >= 0) return 'Pricing Disclosure Gap';
  if (row.CustomerObjectionCategory !== 'None' && row.ObjectionHandling !== '1') return 'Objection Not Resolved';
  if (['Support Pending', 'Callback Required', 'Escalation Required']
    .indexOf(row.Further_Assistance) >= 0) return 'Journey Blocker';
  if (row.Order_Consent !== '1' && !row.progressed && !row.disbursal) return 'Consent Gap';
  if (['Weak Closing', 'Missing Closing', 'Misleading Closing', 'Call Dropped']
    .indexOf(row.Call_Closing) >= 0) return 'Closing Gap';
  return 'No Major Leakage';
}

function actionFor(row: EnrichedCallRow): ActionItem {
  if (row.riskBucket === 'High Priority Risk Trigger')
    return { priority: 'P1 Validate', owner: 'QA | Compliance', sla: 'Same Day', reason: row.SensitiveWordUsed };
  if (row.riskBucket === 'Medium Transparency / Sensitive Flag')
    return { priority: 'P2 Coach / Validate', owner: 'QA | TL', sla: '24 Hours', reason: row.SensitiveWordUsed };
  if (row.opportunity && ['No Pitch Attempted', 'Weak Pitch', 'Pricing Disclosure Gap'].indexOf(row.salesLeakage) >= 0)
    return { priority: 'P3 Sales Coaching', owner: 'TL | Sales Trainer', sla: '48 Hours', reason: row.salesLeakage };
  if (['Support Pending', 'Callback Required', 'Escalation Required'].indexOf(row.supportStatus) >= 0)
    return { priority: 'P3 Journey Follow-Up', owner: 'Process Owner | TL', sla: '48 Hours', reason: row.supportStatus };
  return { priority: 'Monitor', owner: 'TL', sla: 'Weekly Review', reason: 'No immediate action trigger' };
}

export function enrichRow(raw: RawCallRow): EnrichedCallRow {
  const callType = value(raw.ConsumptionType);
  const journeyStage = value(raw.AgeofConsumption);
  const pitchStrength = value(raw.UpsellingEfforts);
  const score = numeric(raw.Feedback_Category) ?? scoreFromContext(raw.FeedbackContext);
  const nonAssessable = callType === 'No Meaningful Interaction';
  const band = qualityBand({ nonAssessable, score });
  const opportunity = ['Sales', 'Mixed'].indexOf(callType) >= 0;
  const progressed = PROGRESSED_DISPOSITIONS.indexOf(raw.CallDisposition) >= 0;
  const disbursal = raw.SaleDone === '1';
  const risk = riskBucket(raw);
  const supportStatus = value(raw.Further_Assistance);

  const partial: EnrichedCallRow = {
    ...raw,
    id: String(raw.id || '').trim(),
    client_id: String(raw.client_id || '').trim(),
    callType,
    journeyStage,
    pitchStrength,
    score,
    nonAssessable,
    qualityBand: band,
    opportunity,
    progressed,
    disbursal,
    riskBucket: risk,
    supportStatus,
    salesLeakage: 'Not Applicable' as SalesLeakage,
    evidenceHighlights: [],
    action: { priority: 'Monitor', owner: 'TL', sla: 'Weekly Review', reason: '' },
  };

  partial.salesLeakage = salesLeakage(partial);
  partial.action = actionFor(partial);

  return partial;
}

export function enrichRows(rawRows: RawCallRow[]): EnrichedCallRow[] {
  return (rawRows || []).map(enrichRow);
}

export function maskMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length >= 4 ? 'XXXXXX' + digits.slice(-4) : 'Masked';
}

export function maskTranscript(text: string): string {
  return String(text || '')
    .replace(/\b\d{10,}\b/g, (match) =>
      '•'.repeat(Math.max(0, match.length - 4)) + match.slice(-4)
    )
    .replace(/((?:otp|pin|cvv|password)\s*(?:is|:|-)?\s*)(\d{3,8})/ig, (_full, prefix, digits) =>
      prefix + '•'.repeat(digits.length)
    );
}
