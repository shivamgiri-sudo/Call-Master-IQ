// src/callmaster/services/processService.ts
import db from '../../config/db';
import { getProcessConfig } from '../config/processRegistry';
import {
  getFatalAnalysis,
  getScenarioBreakdown,
  getDetailAnalysis,
  getEscalationAnalysis,
  getInboundExplorer,
} from '../repositories/inboundRepo';
import {
  getCstCrtFunnel,
  getMissedOpportunities,
  getNpsCsat,
  getPitchStageAnalysis,
  getObjectionRebuttal,
  getOutboundExplorer,
} from '../repositories/outboundRepo';
import { Preset } from '../repositories/baseRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PmParams {
  processName: string;
  preset: string;
  startDate?: string;
  endDate?: string;
}

// ---------------------------------------------------------------------------
// Helper: resolve date range from preset / custom
// ---------------------------------------------------------------------------

function dateRange(
  preset: string,
  startDate?: string,
  endDate?: string,
): { start: string; end: string } {
  const now = new Date();
  if (preset === 'custom' && startDate && endDate) return { start: startDate, end: endDate };
  if (preset === 'D1') {
    const d = now.toISOString().slice(0, 10);
    return { start: d, end: d };
  }
  if (preset === 'WTD') {
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1; // Mon start
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    return {
      start: mon.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }
  // MTD default
  return {
    start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    end: now.toISOString().slice(0, 10),
  };
}

// Map preset string (including 'custom') to base Preset type for repo calls
function toPreset(preset: string): Preset {
  if (preset === 'WTD') return 'WTD';
  if (preset === 'D1') return 'D1';
  return 'MTD';
}

// ---------------------------------------------------------------------------
// Helper: execute on Shivamgiri pool
// ---------------------------------------------------------------------------

async function qDb(sql: string, params: any[]): Promise<any[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// pmOverview
// ---------------------------------------------------------------------------

export async function pmOverview(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  const cfg = await getProcessConfig(processName);
  const targetCqPct = cfg?.targetCqPct ?? 80;
  const sourceType = cfg?.sourceType ?? 'Inbound';

  const rows = await qDb(
    `SELECT
       call_quality_percentage,
       fatal_flag,
       audit_date
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND audit_date BETWEEN ? AND ?`,
    [processName, start, end],
  );

  const totalCalls = rows.length;
  const avgQuality =
    totalCalls > 0
      ? +(rows.reduce((s: number, r: any) => s + Number(r.call_quality_percentage ?? 0), 0) / totalCalls).toFixed(2)
      : 0;
  const fatalCount = rows.filter((r: any) => r.fatal_flag == 1 || r.fatal_flag === true).length;
  const fatalPct = totalCalls > 0 ? +((fatalCount / totalCalls) * 100).toFixed(2) : 0;

  let tqCount = 0;
  let bqCount = 0;
  let mqCount = 0;
  for (const r of rows) {
    const q = Number(r.call_quality_percentage ?? 0);
    if (q >= targetCqPct + 5) tqCount++;
    else if (q < targetCqPct - 5) bqCount++;
    else mqCount++;
  }
  const tqPct = totalCalls > 0 ? +((tqCount / totalCalls) * 100).toFixed(2) : 0;
  const mqPct = totalCalls > 0 ? +((mqCount / totalCalls) * 100).toFixed(2) : 0;
  const bqPct = totalCalls > 0 ? +((bqCount / totalCalls) * 100).toFixed(2) : 0;

  // Daily trend
  const trendMap = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const date = r.audit_date instanceof Date
      ? r.audit_date.toISOString().slice(0, 10)
      : String(r.audit_date).slice(0, 10);
    const existing = trendMap.get(date) ?? { sum: 0, count: 0 };
    existing.sum += Number(r.call_quality_percentage ?? 0);
    existing.count += 1;
    trendMap.set(date, existing);
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      avgQuality: +(sum / count).toFixed(2),
    }));

  return {
    processName,
    sourceType,
    targetCqPct,
    totalCalls,
    avgQuality,
    fatalPct,
    tqCount,
    mqCount,
    bqCount,
    tqPct,
    mqPct,
    bqPct,
    trend,
  };
}

// ---------------------------------------------------------------------------
// pmAgentLeaderboard
// ---------------------------------------------------------------------------

export async function pmAgentLeaderboard(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  const cfg = await getProcessConfig(processName);
  const targetCqPct = cfg?.targetCqPct ?? 80;

  const rows = await qDb(
    `SELECT
       agent_name,
       emp_id,
       COUNT(*) AS totalCalls,
       ROUND(AVG(call_quality_percentage), 2) AS avgQuality,
       ROUND(SUM(CASE WHEN fatal_flag = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS fatalPct
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND audit_date BETWEEN ? AND ?
     GROUP BY agent_name, emp_id
     ORDER BY avgQuality DESC
     LIMIT 50`,
    [processName, start, end],
  );

  return rows.map((r: any) => {
    const avg = Number(r.avgQuality ?? 0);
    let classification: 'TQ' | 'MQ' | 'BQ';
    if (avg >= targetCqPct + 5) classification = 'TQ';
    else if (avg < targetCqPct - 5) classification = 'BQ';
    else classification = 'MQ';
    return {
      agent_name: r.agent_name,
      emp_id: r.emp_id,
      totalCalls: Number(r.totalCalls),
      avgQuality: avg,
      fatalPct: Number(r.fatalPct ?? 0),
      classification,
    };
  });
}

// ---------------------------------------------------------------------------
// pmLobBreakdown
// ---------------------------------------------------------------------------

export async function pmLobBreakdown(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  const cfg = await getProcessConfig(processName);
  const targetCqPct = cfg?.targetCqPct ?? 80;

  const rows = await qDb(
    `SELECT
       lob_name,
       COUNT(*) AS totalCalls,
       ROUND(AVG(call_quality_percentage), 2) AS avgQuality,
       ROUND(SUM(CASE WHEN fatal_flag = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS fatalPct
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND audit_date BETWEEN ? AND ?
     GROUP BY lob_name
     ORDER BY totalCalls DESC`,
    [processName, start, end],
  );

  return rows.map((r: any) => ({
    lob_name: r.lob_name,
    totalCalls: Number(r.totalCalls),
    avgQuality: Number(r.avgQuality ?? 0),
    fatalPct: Number(r.fatalPct ?? 0),
    targetCqPct,
  }));
}

// ---------------------------------------------------------------------------
// Delegating functions — inbound repo
// ---------------------------------------------------------------------------

export async function pmFatalAnalysis(params: PmParams) {
  const { processName, preset } = params;
  return getFatalAnalysis({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmScenarioBreakdown(params: PmParams) {
  const { processName, preset } = params;
  return getScenarioBreakdown({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmDetailAnalysis(params: PmParams) {
  const { processName, preset } = params;
  return getDetailAnalysis({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmEscalationAnalysis(params: PmParams) {
  const { processName, preset } = params;
  return getEscalationAnalysis({ processIds: [processName], preset: toPreset(preset) });
}

// ---------------------------------------------------------------------------
// pmParameterBreakdown
// ---------------------------------------------------------------------------

export async function pmParameterBreakdown(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  const rows = await qDb(
    `SELECT
       AVG(mqa.professionalism_maintained)*100 AS professionalism_maintained,
       AVG(mqa.accurate_issue_probing)*100 AS accurate_issue_probing,
       AVG(mqa.case_escalated_correctly)*100 AS case_escalated_correctly,
       AVG(mqa.proper_hold_procedure)*100 AS proper_hold_procedure,
       AVG(mqa.correct_and_complete_information)*100 AS correct_and_complete_information,
       AVG(mqa.proper_call_closure)*100 AS proper_call_closure,
       COUNT(*) AS total
     FROM manual_qa_audit mqa
     JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
     WHERE k.process_name = ? AND k.audit_date BETWEEN ? AND ?`,
    [processName, start, end],
  );

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// pmTniReport
// ---------------------------------------------------------------------------

export async function pmTniReport(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  return qDb(
    `SELECT
       k.agent_name,
       k.emp_id,
       AVG(mqa.professionalism_maintained)*100 AS professionalism_maintained,
       AVG(mqa.accurate_issue_probing)*100 AS accurate_issue_probing,
       AVG(mqa.case_escalated_correctly)*100 AS case_escalated_correctly,
       AVG(mqa.proper_hold_procedure)*100 AS proper_hold_procedure,
       AVG(mqa.correct_and_complete_information)*100 AS correct_and_complete_information,
       AVG(mqa.proper_call_closure)*100 AS proper_call_closure,
       COUNT(*) AS total
     FROM manual_qa_audit mqa
     JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
     WHERE k.process_name = ? AND k.audit_date BETWEEN ? AND ?
     GROUP BY k.agent_name, k.emp_id
     ORDER BY k.agent_name`,
    [processName, start, end],
  );
}

// ---------------------------------------------------------------------------
// pmCoachingQueue — call_coaching_queue may not exist yet; handle gracefully
// ---------------------------------------------------------------------------

export async function pmCoachingQueue(params: PmParams) {
  const { processName } = params;

  const rows = await qDb(
    `SELECT q.*, k.agent_name, k.call_quality_percentage
     FROM call_coaching_queue q
     JOIN v_call_master_unified_kpi k ON q.source_call_id = k.source_call_id
     WHERE k.process_name = ? AND q.status = 'pending'
     ORDER BY k.call_quality_percentage ASC
     LIMIT 50`,
    [processName],
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Delegating functions — outbound repo
// ---------------------------------------------------------------------------

export async function pmCstCrtFunnel(params: PmParams) {
  const { processName, preset } = params;
  return getCstCrtFunnel({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmMissedOpportunities(params: PmParams) {
  const { processName, preset } = params;
  return getMissedOpportunities({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmNpsCsat(params: PmParams) {
  const { processName, preset } = params;
  return getNpsCsat({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmPitchStageAnalysis(params: PmParams) {
  const { processName, preset } = params;
  return getPitchStageAnalysis({ processIds: [processName], preset: toPreset(preset) });
}

export async function pmObjectionRebuttal(params: PmParams) {
  const { processName, preset } = params;
  return getObjectionRebuttal({ processIds: [processName], preset: toPreset(preset) });
}

// ---------------------------------------------------------------------------
// pmOutboundExplorer
// ---------------------------------------------------------------------------

export async function pmOutboundExplorer(
  params: PmParams & { page?: number; pageSize?: number; search?: string; lob?: string },
) {
  const { processName, preset, page = 1, pageSize = 20 } = params;
  return getOutboundExplorer({
    processIds: [processName],
    preset: toPreset(preset),
    page,
    limit: pageSize,
  });
}

// ---------------------------------------------------------------------------
// pmInboundExplorer
// ---------------------------------------------------------------------------

export async function pmInboundExplorer(
  params: PmParams & { page?: number; pageSize?: number; search?: string; lob?: string },
) {
  const { processName, preset, page = 1, pageSize = 20 } = params;
  return getInboundExplorer({
    processIds: [processName],
    preset: toPreset(preset),
    page,
    limit: pageSize,
  });
}
