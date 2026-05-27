// src/callmaster/services/analystService.ts
import db from '../../config/db';
import { presetToDateRange, paginationClause, Preset } from '../repositories/baseRepository';

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows as T[];
}

export async function myOverview(preset: Preset, employeeCode: string) {
  const { startDate, endDate } = presetToDateRange(preset);

  const rows = await q<any>(`
    SELECT
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS fatal_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND agent_employee_code = ?
      AND quality_score IS NOT NULL
    GROUP BY process_name, source_type
  `, [startDate, endDate, employeeCode]);

  const target = rows.length > 0 && rows[0].source_type === 'Outbound' ? 80 : 95;

  return {
    processes: rows,
    overall_score: rows.length > 0
      ? +(rows.reduce((s: number, r: any) => s + Number(r.avg_score ?? 0), 0) / rows.length).toFixed(2)
      : null,
    total_calls: rows.reduce((s: number, r: any) => s + Number(r.total_calls ?? 0), 0),
    fatal_count: rows.reduce((s: number, r: any) => s + Number(r.fatal_count ?? 0), 0),
    target_cq_pct: target,
  };
}

export async function myDefects(preset: Preset, employeeCode: string) {
  const { startDate, endDate } = presetToDateRange(preset);

  // Inbound parameter-level defects from manual_qa_audit (Shivamgiri, no prefix)
  // Use UNION ALL to return one row per parameter
  return q(`
    SELECT 'professionalism_maintained' AS param,
      SUM(CASE WHEN mqa.professionalism_maintained < 1 THEN 1 ELSE 0 END) AS lost_marks
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'accurate_issue_probing',
      SUM(CASE WHEN mqa.accurate_issue_probing < 1 THEN 1 ELSE 0 END)
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'case_escalated_correctly',
      SUM(CASE WHEN mqa.case_escalated_correctly < 1 THEN 1 ELSE 0 END)
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'proper_hold_procedure',
      SUM(CASE WHEN mqa.proper_hold_procedure < 1 THEN 1 ELSE 0 END)
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'correct_and_complete_information',
      SUM(CASE WHEN mqa.correct_and_complete_information < 1 THEN 1 ELSE 0 END)
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'proper_call_closure',
      SUM(CASE WHEN mqa.proper_call_closure < 1 THEN 1 ELSE 0 END)
    FROM manual_qa_audit mqa
    JOIN v_call_master_unified_kpi k ON mqa.source_call_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
  `, [
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
  ]);
}

export async function myCalls(preset: Preset, employeeCode: string, page = 1, limit = 50) {
  const { startDate, endDate } = presetToDateRange(preset);

  const [[{ total }]] = await (db as any).execute(
    `SELECT COUNT(*) AS total FROM v_call_master_unified_kpi
     WHERE call_date BETWEEN ? AND ? AND agent_employee_code = ?`,
    [startDate, endDate, employeeCode]
  );

  const calls = await q(`
    SELECT source_call_id AS id, source_type, process_name,
           call_date, quality_score, quality_band, alert_severity
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND agent_employee_code = ?
    ORDER BY call_date DESC
    ${paginationClause({ page, limit })}
  `, [startDate, endDate, employeeCode]);

  return { total: Number(total), calls };
}

export async function myTrend(employeeCode: string) {
  return q(`
    SELECT call_date,
           COUNT(*) AS total_calls,
           ROUND(AVG(quality_score), 2) AS avg_score
    FROM v_call_master_unified_kpi
    WHERE call_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND agent_employee_code = ?
      AND quality_score IS NOT NULL
    GROUP BY call_date
    ORDER BY call_date
  `, [employeeCode]);
}

export async function myCoachingNotes(employeeCode: string) {
  return q(`
    SELECT coaching_id AS id, coaching_title AS title, coaching_reason AS notes,
           assigned_to AS coach, priority, status, created_at
    FROM call_coaching_queue
    WHERE agent_employee_code = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [employeeCode]);
}

export async function myCallDetail(sourceType: string, callId: string, employeeCode: string, role: string) {
  if (role === 'analyst') {
    const check = await q<any>(`SELECT agent_employee_code FROM v_call_master_unified_kpi WHERE source_call_id = ? LIMIT 1`, [callId]);
    if (!check.length || check[0].agent_employee_code !== employeeCode) {
      throw new Error('Access denied: call does not belong to this analyst');
    }
  }

  if (sourceType === 'Inbound') {
    const rows = await q<any>(`
      SELECT
        'Inbound' AS source_type,
        cqa.id AS source_call_id,
        pm.process_name,
        pm.business_lob,
        pm.branch AS branch_short_name,
        esa.employee_code AS agent_employee_code,
        emm.employee_name AS agent_employee_name,
        CONCAT('XXXXXX', RIGHT(cqa.MobileNo, 4)) AS mobile_no_masked,
        cqa.CallDate AS call_datetime,
        cqa.length_in_sec,
        cqa.quality_percentage AS quality_score,
        cqa.total_score,
        cqa.max_score,
        cqa.areas_for_improvement,
        cqa.Transcribe_Text AS transcript_text,
        cqa.overall_fraud_risk_score,
        cqa.data_theft_or_misuse,
        cqa.unprofessional_behavior,
        cqa.system_manipulation,
        cqa.financial_fraud,
        cqa.escalation_failure,
        cqa.collusion,
        cqa.policy_communication_failure
      FROM db_audit.call_quality_assessment cqa
      INNER JOIN process_mapping_master pm
        ON CONVERT(pm.dialdesk_client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
         = CONVERT(cqa.ClientId USING utf8mb4) COLLATE utf8mb4_unicode_ci
        AND pm.source_type = 'Inbound' AND pm.active_status = 1
      LEFT JOIN employee_source_alias esa
        ON CONVERT(esa.source_alias USING utf8mb4) COLLATE utf8mb4_unicode_ci
         = CONVERT(cqa.User USING utf8mb4) COLLATE utf8mb4_unicode_ci
        AND esa.active_status = 1
      LEFT JOIN employee_mapping_master emm
        ON emm.employee_code = esa.employee_code AND emm.active_status = 1
      WHERE cqa.id = ?
      LIMIT 1
    `, [callId]);
    return rows[0] || null;
  }

  // Outbound
  const rows = await q<any>(`
    SELECT
      'Outbound' AS source_type,
      cd.id AS source_call_id,
      pm.process_name,
      pm.business_lob,
      pm.branch AS branch_short_name,
      esa.employee_code AS agent_employee_code,
      emm.employee_name AS agent_employee_name,
      CONCAT('XXXXXX', RIGHT(cd.MobileNo, 4)) AS mobile_no_masked,
      cd.CallDate AS call_datetime,
      cd.length_in_sec,
      NULL AS quality_score,
      cd.AreaForImprovement AS areas_for_improvement,
      cd.TranscribeText AS transcript_text,
      cd.CallDisposition,
      cd.SaleDone,
      cd.Feedback_Category,
      cd.FeedbackContext,
      cd.AgentRebuttalCategory,
      cd.CustomerObjectionCategory,
      cd.Opening,
      cd.Offered,
      cd.ObjectionHandling,
      cd.PrepaidPitch,
      cd.UpsellingEfforts
    FROM db_external.CallDetails cd
    INNER JOIN process_mapping_master pm
      ON CONVERT(pm.dialdesk_client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(cd.client_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
      AND pm.source_type = 'Outbound' AND pm.active_status = 1
    LEFT JOIN employee_source_alias esa
      ON CONVERT(esa.source_alias USING utf8mb4) COLLATE utf8mb4_unicode_ci
       = CONVERT(cd.AgentName USING utf8mb4) COLLATE utf8mb4_unicode_ci
      AND esa.active_status = 1
    LEFT JOIN employee_mapping_master emm
      ON emm.employee_code = esa.employee_code AND emm.active_status = 1
    WHERE cd.id = ?
    LIMIT 1
  `, [callId]);
  return rows[0] || null;
}
