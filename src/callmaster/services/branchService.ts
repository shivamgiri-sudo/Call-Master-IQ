// src/callmaster/services/branchService.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';
import { acknowledgeAlert } from '../../services/alertService';

interface Scope { branchIds: string[]; processIds: string[]; }

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows as T[];
}

export async function bmHealth(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const [row] = await q<any>(`
    SELECT
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count,
      SUM(CASE WHEN alert_severity IN ('Critical','High') THEN 1 ELSE 0 END) AS high_risk_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
  `, [startDate, endDate, ...bParams, ...pParams]);

  return {
    quality_score:   row?.quality_score ?? null,
    total_calls:     Number(row?.total_calls ?? 0),
    critical_count:  Number(row?.critical_count ?? 0),
    high_risk_count: Number(row?.high_risk_count ?? 0),
  };
}

export async function bmProcessBreakdown(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return q(`
    SELECT
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
    GROUP BY process_name, source_type
    ORDER BY quality_score DESC
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function bmTeamPerformance(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const analysts = await q<any>(`
    SELECT
      agent_employee_code AS employee_code,
      agent_employee_name AS name,
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
      AND quality_score IS NOT NULL
    GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
    ORDER BY avg_score DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);

  // coaching count — call_coaching_queue has branch_short_name but not agent_employee_name
  const coachingCounts = await q<any>(`
    SELECT agent_employee_code, COUNT(*) AS coaching_count
    FROM call_coaching_queue
    WHERE status = 'Open' AND ${bClause}
    GROUP BY agent_employee_code
  `, bParams);

  const coachMap = new Map(coachingCounts.map((r: any) => [r.agent_employee_code, Number(r.coaching_count)]));

  return analysts.map((r: any) => ({
    ...r,
    coaching_count: coachMap.get(r.employee_code) ?? 0,
  }));
}

export async function bmDailySla(scope: Scope) {
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  const [row] = await q<any>(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(CASE WHEN quality_score IS NOT NULL THEN 1 ELSE 0 END) AS audited_calls
    FROM v_call_master_unified_kpi
    WHERE call_date = CURDATE() AND ${bClause}
  `, bParams);

  const total   = Number(row?.total_calls ?? 0);
  const audited = Number(row?.audited_calls ?? 0);

  return {
    total_calls:    total,
    audited_calls:  audited,
    pending_calls:  total - audited,
    coverage_pct:   total > 0 ? Math.round((audited / total) * 100) : 0,
  };
}

export async function bmRiskCalls(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  return q(`
    SELECT
      source_call_id AS id, source_type, process_name,
      agent_employee_name AS agent, alert_severity, call_date
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High')
      AND ${bClause}
    ORDER BY FIELD(alert_severity,'Critical','High'), call_date DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams]);
}

export async function bmActionItems(scope: Scope) {
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  return q(`
    SELECT coaching_id AS id, 'Coaching' AS item_type,
           agent_employee_code, process_name, coaching_title AS title,
           priority, status, due_date, created_at
    FROM call_coaching_queue
    WHERE status = 'Open' AND ${bClause}
    ORDER BY FIELD(priority,'High','Medium','Low'), due_date ASC
    LIMIT 100
  `, bParams);
}

export async function bmSnapshotTrend(params: { branchName: string; preset: Preset; startDate?: string; endDate?: string }) {
  const { branchName, preset, startDate, endDate } = params;
  const { startDate: start, endDate: end } = presetToDateRange(preset);
  const resolvedStart = startDate || start;
  const resolvedEnd   = endDate   || end;

  return q(
    `SELECT snapshot_date AS call_date,
            ROUND(AVG(avg_quality_score), 2) AS avg_score,
            SUM(critical_calls) AS critical_count
     FROM daily_performance_snapshot
     WHERE branch_short_name = ? AND snapshot_date BETWEEN ? AND ?
     GROUP BY snapshot_date
     ORDER BY snapshot_date`,
    [branchName, resolvedStart, resolvedEnd],
  );
}

export async function bmAcknowledgeAlert(alertId: number, userId: number) {
  return acknowledgeAlert(alertId, userId);
}
