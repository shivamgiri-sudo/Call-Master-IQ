// src/callmaster/services/orgService.ts
import {
  getOrgScorecard, getProcessMatrix, getBranchComparison,
  getRiskExposure, getOrgTrend, getCriticalAlerts
} from '../repositories/unifiedKpiRepo';
import { Preset } from '../repositories/baseRepository';

interface Scope { branchIds: string[]; processIds: string[]; }

export async function ceoScorecard(preset: Preset, scope: Scope) {
  const rows = await getOrgScorecard({ ...scope, preset });
  const inbound  = rows.find((r: any) => r.source_type === 'Inbound');
  const outbound = rows.find((r: any) => r.source_type === 'Outbound');
  return {
    outbound_score:   outbound ? Number(outbound.avg_quality_score) : null,
    inbound_score:    inbound  ? Number(inbound.avg_quality_score)  : null,
    total_calls:      rows.reduce((s: number, r: any) => s + Number(r.total_calls), 0),
    critical_calls:   rows.reduce((s: number, r: any) => s + Number(r.critical_calls), 0),
    inbound_calls:    Number(inbound?.total_calls  ?? 0),
    outbound_calls:   Number(outbound?.total_calls ?? 0),
  };
}

export async function ceoProcessMatrix(preset: Preset, scope: Scope) {
  return getProcessMatrix({ ...scope, preset });
}

export async function ceoBranchComparison(preset: Preset, scope: Scope) {
  return getBranchComparison({ ...scope, preset });
}

export async function ceoSlaOverview(preset: Preset, scope: Scope) {
  const rows = await getProcessMatrix({ ...scope, preset });
  return rows.map((r: any) => ({
    process_name: r.process_name,
    source_type:  r.source_type,
    total_calls:  r.total_calls,
    sla_pct:      null, // requires separate audit-count query; placeholder for now
  }));
}

export async function ceoRiskExposure(preset: Preset, scope: Scope) {
  const rows = await getRiskExposure({ ...scope, preset });
  return {
    total_risk: rows.reduce((s: number, r: any) => s + Number(r.count), 0),
    breakdown:  rows,
  };
}

export async function ceoTrend(scope: Scope) {
  return getOrgTrend({ ...scope, days: 30 });
}

export async function ceoAlerts(preset: Preset, scope: Scope) {
  return getCriticalAlerts({ ...scope, preset });
}
