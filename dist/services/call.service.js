"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCalls = listCalls;
exports.getCallDetail = getCallDetail;
exports.buildHeuristicInsight = buildHeuristicInsight;
exports.saveInsight = saveInsight;
exports.getCachedInsight = getCachedInsight;
const db_1 = require("../config/db");
const scope_service_1 = require("./scope.service");
async function listCalls(user, filters) {
    const scope = await (0, scope_service_1.getScopeCondition)(user);
    const startDate = filters.startDate ||
        new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const endDate = filters.endDate ||
        new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const params = [startDate, endDate, ...scope.params];
    let f = '';
    if (filters.branch) {
        f += ' AND branch_short_name=? ';
        params.push(filters.branch);
    }
    if (filters.process) {
        f += ' AND process_name=? ';
        params.push(filters.process);
    }
    if (filters.sourceType) {
        f += ' AND source_type=? ';
        params.push(filters.sourceType);
    }
    const [rows] = await db_1.db.query(`SELECT
       source_call_id, source_type, client_id, process_name, business_lob,
       branch_short_name, campaign_name, lead_id,
       source_agent_name, agent_employee_code, agent_employee_name,
       call_datetime, quality_score, quality_band,
       is_critical_call, alert_severity
     FROM v_call_master_unified_kpi
     WHERE call_datetime >= ? AND call_datetime < ?
       ${scope.whereSql} ${f}
     ORDER BY call_datetime DESC
     LIMIT 200`, params);
    return rows;
}
async function getCallDetail(sourceType, callId) {
    if (sourceType === 'Inbound') {
        const [rows] = await db_1.db.query(`SELECT
         'Inbound' source_type,
         cqa.id source_call_id,
         cqa.ClientId client_id,
         pm.process_name,
         pm.business_lob,
         pm.branch branch_short_name,
         cqa.Campaign campaign_name,
         cqa.lead_id,
         cqa.User source_agent_name,
         esa.employee_code agent_employee_code,
         emm.employee_name agent_employee_name,
         CONCAT('XXXXXX', RIGHT(cqa.MobileNo, 4)) mobile_no_masked,
         cqa.CallDate call_datetime,
         cqa.length_in_sec,
         cqa.quality_percentage quality_score,
         cqa.total_score,
         cqa.max_score,
         cqa.areas_for_improvement,
         cqa.Transcribe_Text transcript_text,
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
         ON CONVERT(esa.source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci
          = CONVERT(cqa.User USING utf8mb4) COLLATE utf8mb4_unicode_ci
         AND esa.active_status = 1
       LEFT JOIN employee_mapping_master emm
         ON emm.employee_code = esa.employee_code AND emm.active_status = 1
       WHERE cqa.id = ?
       LIMIT 1`, [callId]);
        return rows[0] || null;
    }
    // Outbound
    const [rows] = await db_1.db.query(`SELECT
       'Outbound' source_type,
       cd.id source_call_id,
       cd.client_id,
       pm.process_name,
       pm.business_lob,
       pm.branch branch_short_name,
       cd.campaign_id campaign_name,
       cd.LeadID lead_id,
       cd.AgentName source_agent_name,
       esa.employee_code agent_employee_code,
       emm.employee_name agent_employee_name,
       CONCAT('XXXXXX', RIGHT(cd.MobileNo, 4)) mobile_no_masked,
       cd.CallDate call_datetime,
       cd.length_in_sec,
       NULL quality_score,
       cd.AreaForImprovement areas_for_improvement,
       cd.TranscribeText transcript_text,
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
       ON CONVERT(esa.source_agent_name USING utf8mb4) COLLATE utf8mb4_unicode_ci
        = CONVERT(cd.AgentName USING utf8mb4) COLLATE utf8mb4_unicode_ci
       AND esa.active_status = 1
     LEFT JOIN employee_mapping_master emm
       ON emm.employee_code = esa.employee_code AND emm.active_status = 1
     WHERE cd.id = ?
     LIMIT 1`, [callId]);
    return rows[0] || null;
}
function buildHeuristicInsight(d) {
    const t = String(d?.transcript_text || '').toLowerCase();
    const outbound = d?.source_type === 'Outbound';
    const misses = [];
    if (t.includes('legal') || t.includes('complaint'))
        misses.push('Escalation/legal language detected.');
    if (outbound && !d?.SaleDone)
        misses.push('Sale not confirmed; check objection handling.');
    if (d?.quality_score !== null && Number(d.quality_score) < 85)
        misses.push('Quality below safe threshold.');
    return {
        summary: d
            ? `Call ${d.source_call_id} handled by ${d.source_agent_name || 'agent'} requires ${misses.length ? 'review' : 'normal validation'}.`
            : 'Call not found.',
        nps_risk: misses.length >= 2 ? 'High' : misses.length ? 'Medium' : 'Low',
        sales_impact: outbound
            ? d?.SaleDone
                ? 'Converted'
                : 'Potential leakage'
            : 'Not applicable',
        coaching_points: misses.length
            ? misses
            : ['Use as normal coaching evidence if repeated.'],
        best_response: 'Acknowledge, probe exact issue, confirm ownership, give clear timeline, and close with commitment.',
        evidence_moments: [
            { moment: 'Opening', finding: 'Check greeting and verification.' },
            { moment: 'Probing', finding: 'Confirm root concern before resolution.' },
            { moment: 'Closure', finding: 'Confirm ownership and next action.' },
        ],
    };
}
async function saveInsight(sourceType, callId, insight) {
    await db_1.db.query(`INSERT INTO call_ai_insight
       (source_type, source_call_id, insight_json, summary_text, nps_risk, sales_impact, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, 'SYSTEM')`, [
        sourceType,
        callId,
        JSON.stringify(insight),
        insight.summary || '',
        insight.nps_risk || '',
        insight.sales_impact || '',
    ]);
    return insight;
}
async function getCachedInsight(sourceType, callId) {
    const [rows] = await db_1.db.query(`SELECT * FROM call_ai_insight
     WHERE source_type = ? AND source_call_id = ?
     ORDER BY generated_at DESC
     LIMIT 1`, [sourceType, callId]);
    return rows[0] || null;
}
