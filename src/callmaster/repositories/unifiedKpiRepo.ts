// src/callmaster/repositories/unifiedKpiRepo.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from './baseRepository';

interface ScopeOptions {
  branchIds: string[];
  processIds: string[];
  sourceType?: 'Inbound' | 'Outbound';
  preset: Preset;
}

async function execute(sql: string, params: any[]): Promise<any[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows;
}

export async function getOrgScorecard(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS avg_quality_score,
      SUM(is_critical_call) AS critical_calls
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${bClause} AND ${pClause}
    GROUP BY source_type
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getProcessMatrix(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      process_name, source_type, client_id,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count,
      SUM(CASE WHEN alert_severity IN ('Critical','High') THEN 1 ELSE 0 END) AS high_risk_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${bClause} AND ${pClause}
    GROUP BY process_name, source_type, client_id
    ORDER BY source_type, process_name
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getBranchComparison(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      branch_short_name AS branch,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY branch_short_name
    ORDER BY quality_score DESC
  `, [startDate, endDate, ...pParams]);
}

export async function getRiskExposure(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      alert_severity,
      COUNT(*) AS count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High','Medium')
      AND ${bClause} AND ${pClause}
    GROUP BY alert_severity
    ORDER BY FIELD(alert_severity,'Critical','High','Medium')
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getOrgTrend(opts: { branchIds: string[]; processIds: string[]; days?: number }) {
  const days = opts.days || 30;
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      call_date,
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS avg_score
    FROM v_call_master_unified_kpi
    WHERE call_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND ${bClause} AND ${pClause}
    GROUP BY call_date, source_type
    ORDER BY call_date
  `, [days, ...bParams, ...pParams]);
}

export async function getCriticalAlerts(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      source_call_id, source_type, process_name, branch_short_name,
      agent_employee_name AS agent, alert_severity, call_date
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High')
      AND ${bClause} AND ${pClause}
    ORDER BY FIELD(alert_severity,'Critical','High'), call_date DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getTniHeatmap(opts: ScopeOptions) {
  // manual_qa_audit is in Shivamgiri (same DB as v_call_master_inbound_kpi)
  // Join on source_call_id (BIGINT) — both tables share this key
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  return execute(`
    SELECT
      k.agent_employee_name AS agent,
      k.agent_employee_code AS employee_code,
      SUM(CASE WHEN mqa.professionalism_maintained IS NOT NULL AND mqa.professionalism_maintained < 1 THEN 1 ELSE 0 END) AS professionalism_defects,
      SUM(CASE WHEN mqa.accurate_issue_probing IS NOT NULL AND mqa.accurate_issue_probing < 1 THEN 1 ELSE 0 END) AS probing_defects,
      SUM(CASE WHEN mqa.case_escalated_correctly IS NOT NULL AND mqa.case_escalated_correctly < 1 THEN 1 ELSE 0 END) AS escalation_defects,
      SUM(CASE WHEN mqa.proper_hold_procedure IS NOT NULL AND mqa.proper_hold_procedure < 1 THEN 1 ELSE 0 END) AS hold_defects,
      SUM(CASE WHEN mqa.correct_and_complete_information IS NOT NULL AND mqa.correct_and_complete_information < 1 THEN 1 ELSE 0 END) AS info_defects,
      SUM(CASE WHEN mqa.proper_call_closure IS NOT NULL AND mqa.proper_call_closure < 1 THEN 1 ELSE 0 END) AS closure_defects,
      COUNT(DISTINCT mqa.audit_id) AS total_audits
    FROM v_call_master_inbound_kpi k
    INNER JOIN manual_qa_audit mqa ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY k.agent_employee_name, k.agent_employee_code
    ORDER BY escalation_defects DESC
    LIMIT 50
  `, [startDate, endDate, ...pParams]);
}

export async function getAnalystLeaderboard(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      agent_employee_code AS employee_code,
      agent_employee_name AS name,
      process_name,
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND quality_score IS NOT NULL
      AND ${bClause} AND ${pClause}
    GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
    ORDER BY avg_score DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);
}
