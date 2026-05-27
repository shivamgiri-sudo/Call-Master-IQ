// src/callmaster/repositories/inboundRepo.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, paginationClause, Preset } from './baseRepository';

async function execute(sql: string, params: any[]): Promise<any[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows;
}

export async function getInboundCallDetail(callId: string) {
  // cqa is in db_audit, joined via id
  const rows = await execute(`
    SELECT k.*, cqa.scenario, cqa.scenario1, cqa.scenario2,
           cqa.data_theft_or_misuse, cqa.financial_fraud, cqa.escalation_failure,
           cqa.unprofessional_behavior, cqa.collusion, cqa.system_manipulation,
           cqa.Transcribe_Text, cqa.areas_for_improvement,
           cqa.agent_english_cuss_count, cqa.agent_hindi_cuss_count
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.source_call_id = ?
    LIMIT 1
  `, [callId]);
  return rows[0] || null;
}

export async function getInboundExplorer(opts: {
  processIds: string[]; preset: Preset; page: number; limit: number;
  agentCode?: string; scoreBand?: string; severity?: string;
}) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  const where: string[] = [`k.call_date BETWEEN ? AND ?`, pClause];
  const whereParams: any[] = [startDate, endDate, ...pParams];

  if (opts.agentCode) { where.push('k.agent_employee_code = ?'); whereParams.push(opts.agentCode); }
  if (opts.scoreBand) {
    const bandMap: Record<string, string> = {
      'Excellent':     'k.quality_score >= 98',
      'Good':          'k.quality_score >= 90 AND k.quality_score < 98',
      'Average':       'k.quality_score >= 85 AND k.quality_score < 90',
      'Below Average': 'k.quality_score < 85',
    };
    if (bandMap[opts.scoreBand]) where.push(bandMap[opts.scoreBand]);
  }
  if (opts.severity) { where.push('k.alert_severity = ?'); whereParams.push(opts.severity); }

  const whereClause = where.join(' AND ');
  const [[{ total }]] = await (db as any).execute(
    `SELECT COUNT(*) AS total FROM v_call_master_inbound_kpi k WHERE ${whereClause}`,
    whereParams
  );

  const rows = await execute(`
    SELECT k.source_call_id AS id, k.call_date, k.agent_employee_name AS agent,
           k.agent_employee_code, k.quality_score, k.quality_band, k.alert_severity,
           k.process_name, k.campaign_name
    FROM v_call_master_inbound_kpi k
    WHERE ${whereClause}
    ORDER BY k.call_date DESC
    ${paginationClause({ page: opts.page, limit: opts.limit })}
  `, whereParams);

  return { total: Number(total), calls: rows };
}

export async function getFatalAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const [summary] = await execute(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(is_critical_call) AS fatal_calls,
      ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatal_pct,
      ROUND(AVG(CASE WHEN is_critical_call = 0 THEN quality_score END), 2) AS without_fatal_cq
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND ${pClause}
  `, [startDate, endDate, ...pParams]);

  const contributors = await execute(`
    SELECT agent_employee_name AS agent, COUNT(*) AS fatal_count
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND is_critical_call = 1 AND ${pClause}
    GROUP BY agent_employee_name
    ORDER BY fatal_count DESC
    LIMIT 10
  `, [startDate, endDate, ...pParams]);

  const dayWise = await execute(`
    SELECT DATE(call_datetime) AS call_date,
           ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatal_pct
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY DATE(call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  // Scenario × fatal type matrix — cqa has both scenario and fatal flag columns
  const scenarioFatal = await execute(`
    SELECT
      cqa.scenario,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.data_theft_or_misuse,'')))='yes' THEN 1 ELSE 0 END)    AS data_theft,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.financial_fraud,'')))='yes' THEN 1 ELSE 0 END)          AS financial_fraud,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.escalation_failure,'')))='yes' THEN 1 ELSE 0 END)       AS escalation_failure,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.unprofessional_behavior,'')))='yes' THEN 1 ELSE 0 END)  AS unprofessional,
      COUNT(*) AS total
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND cqa.scenario IS NOT NULL AND cqa.scenario != ''
      AND ${pClause}
    GROUP BY cqa.scenario
  `, [startDate, endDate, ...pParams]);

  return {
    fatal_pct:        Number(summary?.fatal_pct ?? 0),
    without_fatal_cq: Number(summary?.without_fatal_cq ?? 0),
    total_calls:      Number(summary?.total_calls ?? 0),
    fatal_calls:      Number(summary?.fatal_calls ?? 0),
    top_contributors: contributors,
    day_wise:         dayWise,
    scenario_fatal:   scenarioFatal,
  };
}

export async function getScenarioBreakdown(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  return execute(`
    SELECT
      cqa.scenario,
      COUNT(*) AS total_calls,
      ROUND(AVG(k.quality_score), 2) AS avg_score,
      SUM(k.is_critical_call) AS fatal_count
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND cqa.scenario IS NOT NULL AND cqa.scenario != ''
      AND ${pClause}
    GROUP BY cqa.scenario
    ORDER BY total_calls DESC
  `, [startDate, endDate, ...pParams]);
}

export async function getDetailAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  // manual_qa_audit is in Shivamgiri — join via source_call_id
  const agentScores = await execute(`
    SELECT
      k.agent_employee_name AS name,
      k.agent_employee_code AS employee_code,
      COUNT(*) AS total_calls,
      ROUND(AVG(k.quality_score), 2) AS avg_score,
      SUM(k.is_critical_call) AS fatal_count,
      ROUND(AVG(mqa.call_answered_within_5_seconds) * 100, 1)    AS opening_pct,
      ROUND(AVG(mqa.case_escalated_correctly) * 100, 1)          AS escalation_pct,
      ROUND(AVG(mqa.correct_and_complete_information) * 100, 1)  AS info_pct,
      ROUND(AVG(mqa.proper_hold_procedure) * 100, 1)             AS hold_pct
    FROM v_call_master_inbound_kpi k
    INNER JOIN manual_qa_audit mqa ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY k.agent_employee_code, k.agent_employee_name
    ORDER BY avg_score DESC
  `, [startDate, endDate, ...pParams]);

  return agentScores.map((r: any) => {
    const score = Number(r.avg_score ?? 0);
    let classification = 'MQ';
    if (score >= 100) classification = 'TQ';
    else if (score >= 90) classification = 'TQ';
    else if (score < 85) classification = 'BQ';
    return { ...r, classification };
  });
}

export async function getEscalationAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  // Escalation signals available in cqa: escalation_failure, data_theft_or_misuse, Competitor_Name, agent cuss counts
  const [summary] = await execute(`
    SELECT
      COUNT(*) AS potential_escalations,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.escalation_failure,'')))='yes' THEN 1 ELSE 0 END) AS escalation_failures,
      SUM(CASE WHEN LOWER(TRIM(COALESCE(cqa.data_theft_or_misuse,'')))='yes' THEN 1 ELSE 0 END) AS data_theft,
      SUM(CASE WHEN cqa.Competitor_Name IS NOT NULL AND TRIM(cqa.Competitor_Name) != '' THEN 1 ELSE 0 END) AS competitor_mentions,
      SUM(CASE WHEN COALESCE(cqa.agent_english_cuss_count,0) + COALESCE(cqa.agent_hindi_cuss_count,0) > 0 THEN 1 ELSE 0 END) AS cuss_incidents
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
      AND (LOWER(TRIM(COALESCE(cqa.escalation_failure,'')))='yes'
        OR LOWER(TRIM(COALESCE(cqa.data_theft_or_misuse,'')))='yes'
        OR (cqa.Competitor_Name IS NOT NULL AND TRIM(cqa.Competitor_Name) != '')
        OR COALESCE(cqa.agent_english_cuss_count,0) + COALESCE(cqa.agent_hindi_cuss_count,0) > 0)
  `, [startDate, endDate, ...pParams]);

  const cussDay = await execute(`
    SELECT DATE(k.call_datetime) AS call_date,
           SUM(COALESCE(cqa.agent_english_cuss_count,0) + COALESCE(cqa.agent_hindi_cuss_count,0)) AS cuss_count
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND COALESCE(cqa.agent_english_cuss_count,0) + COALESCE(cqa.agent_hindi_cuss_count,0) > 0
      AND ${pClause}
    GROUP BY DATE(k.call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  return {
    potential_escalations: Number(summary?.potential_escalations ?? 0),
    escalation_failures:   Number(summary?.escalation_failures ?? 0),
    data_theft:            Number(summary?.data_theft ?? 0),
    competitor_mentions:   Number(summary?.competitor_mentions ?? 0),
    cuss_incidents:        Number(summary?.cuss_incidents ?? 0),
    scam_day_wise:         cussDay,
  };
}
