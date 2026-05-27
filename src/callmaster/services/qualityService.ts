// src/callmaster/services/qualityService.ts
import db from '../../config/db';
import { getAnalystLeaderboard, getTniHeatmap } from '../repositories/unifiedKpiRepo';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';

interface Scope { branchIds: string[]; processIds: string[]; }

async function query<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows as T[];
}

export async function tqQualityDeepdive(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return query(`
    SELECT
      process_name, source_type,
      ROUND(AVG(quality_score), 2) AS avg_score,
      COUNT(*) AS total_calls,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND quality_score IS NOT NULL
      AND ${pClause}
    GROUP BY process_name, source_type
    ORDER BY avg_score DESC
  `, [startDate, endDate, ...pParams]);
}

export async function tqLeaderboard(preset: Preset, scope: Scope) {
  const rows = await getAnalystLeaderboard({ ...scope, preset });
  return rows.map((r: any) => {
    const target = r.source_type === 'Inbound' ? 95 : 80;
    let classification = 'MQ';
    if (Number(r.avg_score) >= target + 5) classification = 'TQ';
    else if (Number(r.avg_score) < target - 5) classification = 'BQ';
    return { ...r, classification };
  });
}

export async function tqTniHeatmap(preset: Preset, scope: Scope) {
  return getTniHeatmap({ ...scope, preset });
}

export async function tqCoachingQueue(preset: Preset, scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  const rows = await query(`
    SELECT coaching_id AS id, source_type, process_name, agent_employee_code,
           assigned_to, coaching_title, coaching_reason, priority, status, due_date, created_at
    FROM call_coaching_queue
    WHERE ${pClause} AND ${bClause}
    ORDER BY FIELD(priority,'High','Medium','Low'), created_at DESC
    LIMIT 200
  `, [...pParams, ...bParams]);

  return {
    open:  rows.filter((r: any) => r.status === 'Open').length,
    items: rows,
  };
}

export async function tqCalibration(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('cs.process_name', scope.processIds);

  // session_status is 'open'/'closed' (lowercase enum)
  return query(`
    SELECT cs.session_id AS id, cs.created_at AS date, cs.session_name, cs.process_name,
           cs.session_status AS status,
           ROUND(AVG(ABS(COALESCE(cc.manual_quality_percentage, 0) - COALESCE(cc.ai_quality_percentage, 0))), 2) AS variance_score,
           COUNT(cc.calibration_id) AS call_count
    FROM calibration_session cs
    LEFT JOIN calibration_call cc ON cc.session_id = cs.session_id
    WHERE ${pClause}
    GROUP BY cs.session_id
    ORDER BY cs.created_at DESC
    LIMIT 50
  `, pParams);
}

export async function tqAuditEfficiency(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const rows = await query(`
    SELECT
      DATE(call_datetime) AS call_date,
      COUNT(*) AS total_calls,
      SUM(CASE WHEN quality_score IS NOT NULL THEN 1 ELSE 0 END) AS audited_calls
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY DATE(call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  const total   = rows.reduce((s: number, r: any) => s + Number(r.total_calls), 0);
  const audited = rows.reduce((s: number, r: any) => s + Number(r.audited_calls), 0);

  return {
    total_calls:   total,
    audited_calls: audited,
    pending:       total - audited,
    sla_pct:       total > 0 ? Math.round((audited / total) * 100) : 0,
    daily:         rows,
  };
}

export async function tqParameterDrift(scope: Scope) {
  // manual_qa_audit is in Shivamgiri (same DB), joined via source_call_id
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', scope.processIds);

  // Compare last 7 days avg vs prior 7 days avg for 6 key parameters
  const params = [
    { col: 'professionalism_maintained',       label: 'Professionalism' },
    { col: 'accurate_issue_probing',           label: 'Issue Probing' },
    { col: 'case_escalated_correctly',         label: 'Escalation' },
    { col: 'proper_hold_procedure',            label: 'Hold Procedure' },
    { col: 'correct_and_complete_information', label: 'Correct Info' },
    { col: 'proper_call_closure',              label: 'Call Closure' },
  ];

  const selectParts = params.map(p => `
    AVG(CASE WHEN k.call_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN mqa.${p.col} END) AS recent_${p.col},
    AVG(CASE WHEN k.call_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND DATE_SUB(CURDATE(), INTERVAL 8 DAY) THEN mqa.${p.col} END) AS prior_${p.col}
  `).join(',');

  const rows = await query(`
    SELECT ${selectParts}
    FROM v_call_master_inbound_kpi k
    INNER JOIN manual_qa_audit mqa ON mqa.source_call_id = k.source_call_id
    WHERE ${pClause}
  `, pParams);

  if (rows.length === 0) return [];

  const row = rows[0] as any;
  return params
    .map(p => {
      const recent = row[`recent_${p.col}`] != null ? Number(row[`recent_${p.col}`]) : null;
      const prior  = row[`prior_${p.col}`]  != null ? Number(row[`prior_${p.col}`])  : null;
      const change = (recent != null && prior != null) ? Math.round((recent - prior) * 100) / 100 : null;
      return { param_name: p.label, recent_avg: recent, prior_avg: prior, change_pct: change };
    })
    .filter(p => p.change_pct != null && p.change_pct < -0.01)
    .sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0));
}

export async function tqSlaTracker(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return query(`
    SELECT
      assigned_to AS auditor,
      process_name,
      COUNT(*) AS total_assigned,
      SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS completed,
      ROUND(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS sla_pct
    FROM call_coaching_queue
    WHERE ${pClause}
    GROUP BY assigned_to, process_name
    ORDER BY sla_pct ASC
  `, pParams);
}
