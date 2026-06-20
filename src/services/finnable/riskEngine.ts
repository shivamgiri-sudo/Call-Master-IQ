/**
 * Finnable Intelligence — Risk Engine
 * Ported from finnable-dashboard/src/routes/risk.js riskAction() logic
 * Pure functions — no DB access, no side effects.
 */
import { EnrichedCallRow, ActionItem, ActionPriority } from './types';

export function riskAction(row: EnrichedCallRow): ActionItem {
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

export function priorityRank(priority: ActionPriority | 'Monitor'): number {
  const rank: Record<string, number> = { 'P1 Validate': 1, 'P2 Coach / Validate': 2, 'P3 Sales Coaching': 3, 'P3 Journey Follow-Up': 4, 'Monitor': 9 };
  return rank[priority] || 9;
}
