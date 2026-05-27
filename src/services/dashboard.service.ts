import { db } from '../config/db';
import type { AuthUser } from '../middleware/rbac';
import { getScopeCondition } from './scope.service';

export async function getDashboardSummary(
  user: AuthUser | undefined,
  startDate: string,
  endDate: string
) {
  const scope = await getScopeCondition(user);
  const params = [startDate, endDate, ...scope.params];

  const [summaryRows]: any = await db.query(
    `SELECT
       COUNT(*) total_calls,
       SUM(source_type='Inbound') inbound_calls,
       SUM(source_type='Outbound') outbound_calls,
       ROUND(AVG(CASE WHEN source_type='Inbound' THEN quality_score END), 2) avg_inbound_quality,
       SUM(is_critical_call=1) critical_calls,
       SUM(alert_severity='Critical') critical_severity_calls,
       SUM(alert_severity='High') high_severity_calls,
       SUM(alert_severity='Medium') medium_severity_calls,
       COUNT(DISTINCT branch_short_name) active_branches,
       COUNT(DISTINCT process_name) active_processes,
       COUNT(DISTINCT agent_employee_code) active_agents
     FROM v_call_master_unified_kpi
     WHERE call_datetime >= ? AND call_datetime < ? ${scope.whereSql}`,
    params
  );

  const [branchRows]: any = await db.query(
    `SELECT
       branch_short_name, process_name, business_lob, source_type,
       COUNT(*) total_calls,
       ROUND(AVG(quality_score), 2) avg_quality_score,
       SUM(is_critical_call=1) critical_calls,
       SUM(alert_severity='Critical') critical_severity_calls,
       SUM(alert_severity='High') high_severity_calls,
       SUM(quality_band='Hit') hit_calls,
       SUM(quality_band='Miss') miss_calls
     FROM v_call_master_unified_kpi
     WHERE call_datetime >= ? AND call_datetime < ? ${scope.whereSql}
     GROUP BY branch_short_name, process_name, business_lob, source_type
     ORDER BY critical_severity_calls DESC, high_severity_calls DESC, avg_quality_score ASC
     LIMIT 100`,
    params
  );

  const [trendRows]: any = await db.query(
    `SELECT
       call_date, source_type,
       COUNT(*) total_calls,
       ROUND(AVG(quality_score), 2) avg_quality_score,
       SUM(is_critical_call=1) critical_calls
     FROM v_call_master_unified_kpi
     WHERE call_datetime >= ? AND call_datetime < ? ${scope.whereSql}
     GROUP BY call_date, source_type
     ORDER BY call_date`,
    params
  );

  return {
    summary: summaryRows[0],
    branch_process_performance: branchRows,
    trend: trendRows,
  };
}

export function buildRoleInsight(roleCode?: string) {
  const map: Record<string, string[]> = {
    CEO: [
      'Enterprise risk is concentrated in a few branches and processes.',
      'Ask Branch Heads for closure ETA, not explanation.',
    ],
    TQ_HEAD: [
      'Prioritize calibration, fatal-risk validation and training-trigger parameters.',
      'Open calibration queue for weak evidence calls.',
    ],
    BRANCH_HEAD: [
      'Focus on manager accountability and open critical closures.',
      'Push high NPS-risk feedback closure.',
    ],
    PROCESS_MANAGER: [
      'Coach bottom agents and close repeat defects first.',
      'Use Call Intelligence 360 evidence for coaching.',
    ],
    ANALYST: [
      'Complete critical feedback, attach evidence and close calibration variance.',
      'Select each call ID and verify transcript evidence.',
    ],
  };
  const v = map[roleCode || 'CEO'] || map['CEO'];
  return { headline: v[0], guidance: v.slice(1) };
}
