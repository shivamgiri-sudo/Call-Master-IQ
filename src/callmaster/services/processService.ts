// src/callmaster/services/processService.ts
import db from '../../config/db';
import { getProcessConfig } from '../config/processRegistry';
import { acknowledgeAlert } from '../../services/alertService';
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
// pmMyProcesses — landing page: all assigned processes with quick KPIs
// ---------------------------------------------------------------------------

export async function pmMyProcesses(params: PmParams & { processIds: string[] }) {
  const { processIds, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);

  // Empty processIds means "all processes" (admin/wildcard)
  const whereProcess = processIds.length
    ? `AND process_name IN (${processIds.map(() => '?').join(',')})`
    : '';

  const rows = await qDb(
    `SELECT
       process_name, source_type, client_id,
       COUNT(*) AS totalCalls,
       ROUND(AVG(quality_score), 2) AS avgQuality,
       ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatalPct
     FROM v_call_master_unified_kpi
     WHERE call_date BETWEEN ? AND ?
       ${whereProcess}
     GROUP BY process_name, source_type, client_id
     ORDER BY process_name`,
    [start, end, ...processIds],
  );

  return rows.map((r: any) => ({
    process_name: r.process_name,
    source_type: r.source_type,
    client_id: String(r.client_id ?? ''),
    totalCalls: Number(r.totalCalls),
    avgQuality: Number(r.avgQuality ?? 0),
    fatalPct: Number(r.fatalPct ?? 0),
    is_finnable: String(r.client_id ?? '') === '497',
  }));
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
       quality_score,
       is_critical_call,
       call_date
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND call_date BETWEEN ? AND ?`,
    [processName, start, end],
  );

  const totalCalls = rows.length;
  const avgQuality =
    totalCalls > 0
      ? +(rows.reduce((s: number, r: any) => s + Number(r.quality_score ?? 0), 0) / totalCalls).toFixed(2)
      : 0;
  const fatalCount = rows.filter((r: any) => r.is_critical_call == 1 || r.is_critical_call === true).length;
  const fatalPct = totalCalls > 0 ? +((fatalCount / totalCalls) * 100).toFixed(2) : 0;

  let tqCount = 0;
  let bqCount = 0;
  let mqCount = 0;
  for (const r of rows) {
    const q = Number(r.quality_score ?? 0);
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
    const date = r.call_date instanceof Date
      ? r.call_date.toISOString().slice(0, 10)
      : String(r.call_date).slice(0, 10);
    const existing = trendMap.get(date) ?? { sum: 0, count: 0 };
    existing.sum += Number(r.quality_score ?? 0);
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
       agent_employee_name AS agent_name,
       agent_employee_code AS emp_id,
       COUNT(*) AS totalCalls,
       ROUND(AVG(quality_score), 2) AS avgQuality,
       ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatalPct
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND call_date BETWEEN ? AND ?
     GROUP BY agent_employee_name, agent_employee_code
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
       business_lob AS lob_name,
       COUNT(*) AS totalCalls,
       ROUND(AVG(quality_score), 2) AS avgQuality,
       ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatalPct
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND call_date BETWEEN ? AND ?
     GROUP BY business_lob
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
     WHERE k.process_name = ? AND k.call_date BETWEEN ? AND ?`,
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
       k.agent_employee_name AS agent_name,
       k.agent_employee_code AS emp_id,
       AVG(mqa.professionalism_maintained)*100 AS professionalism_maintained,
       AVG(mqa.accurate_issue_probing)*100 AS accurate_issue_probing,
       AVG(mqa.case_escalated_correctly)*100 AS case_escalated_correctly,
       AVG(mqa.proper_hold_procedure)*100 AS proper_hold_procedure,
       AVG(mqa.correct_and_complete_information)*100 AS correct_and_complete_information,
       AVG(mqa.proper_call_closure)*100 AS proper_call_closure,
       COUNT(*) AS total
     FROM manual_qa_audit mqa
     JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
     WHERE k.process_name = ? AND k.call_date BETWEEN ? AND ?
     GROUP BY k.agent_employee_name, k.agent_employee_code
     ORDER BY k.agent_employee_name`,
    [processName, start, end],
  );
}

// ---------------------------------------------------------------------------
// pmCoachingQueue — call_coaching_queue may not exist yet; handle gracefully
// ---------------------------------------------------------------------------

export async function pmCoachingQueue(params: PmParams) {
  const { processName } = params;

  const rows = await qDb(
    `SELECT q.coaching_id, q.source_call_id, q.agent_employee_code, q.coaching_title,
            q.coaching_reason, q.priority, q.status, q.due_date,
            k.agent_employee_name AS agent_name, k.quality_score AS call_quality_percentage
     FROM call_coaching_queue q
     JOIN v_call_master_unified_kpi k ON q.source_call_id = k.source_call_id
     WHERE k.process_name = ? AND q.status = 'Open'
     ORDER BY k.quality_score ASC
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

// ---------------------------------------------------------------------------
// pmRiskAlerts — unacknowledged alerts for a process (for PM acknowledge flow)
// ---------------------------------------------------------------------------

export async function pmRiskAlerts(params: PmParams) {
  const { processName, preset, startDate, endDate } = params;
  const { start, end } = dateRange(preset, startDate, endDate);
  return qDb(
    `SELECT alert_id, source_call_id, alert_severity, alert_reason, call_date,
            agent_employee_name AS agent
     FROM v_call_master_unified_kpi
     WHERE process_name = ? AND call_date BETWEEN ? AND ?
       AND alert_severity IN ('Critical','High')
       AND (is_acknowledged IS NULL OR is_acknowledged = 0)
     ORDER BY FIELD(alert_severity,'Critical','High'), call_date DESC
     LIMIT 50`,
    [processName, start, end],
  );
}

// ---------------------------------------------------------------------------
// pmAcknowledgeAlert
// ---------------------------------------------------------------------------

export async function pmAcknowledgeAlert(alertId: number, userId: number) {
  return acknowledgeAlert(alertId, userId);
}
