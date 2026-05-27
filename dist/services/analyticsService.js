"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardKPIs = getDashboardKPIs;
exports.getAgentPerformance = getAgentPerformance;
exports.getBranchPerformance = getBranchPerformance;
exports.getProcessPerformance = getProcessPerformance;
exports.getQualityTrends = getQualityTrends;
exports.getParameterFailureRates = getParameterFailureRates;
exports.getDailyReport = getDailyReport;
const db_1 = __importDefault(require("../config/db"));
const rbac_1 = require("../middleware/rbac");
function buildFilter(f) {
    const conditions = [];
    const params = [];
    const { clause: scopeClause, params: scopeParams } = (0, rbac_1.buildScopeWhereClause)(f.scope);
    if (scopeClause !== '1=1') {
        conditions.push(scopeClause);
        params.push(...scopeParams);
    }
    if (f.client_id) {
        conditions.push('client_id = ?');
        params.push(f.client_id);
    }
    if (f.from) {
        conditions.push('call_date >= ?');
        params.push(f.from);
    }
    if (f.to) {
        conditions.push('call_date <= ?');
        params.push(f.to);
    }
    if (f.source_type) {
        conditions.push('source_type = ?');
        params.push(f.source_type);
    }
    if (f.process_name) {
        conditions.push('process_name = ?');
        params.push(f.process_name);
    }
    if (f.business_lob) {
        conditions.push('business_lob = ?');
        params.push(f.business_lob);
    }
    if (f.branch_short_name) {
        conditions.push('branch_short_name = ?');
        params.push(f.branch_short_name);
    }
    return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}
async function getDashboardKPIs(f) {
    const { where, params } = buildFilter(f);
    const [summary] = await db_1.default.execute(`SELECT
       COUNT(*) AS total_calls,
       COUNT(CASE WHEN quality_score IS NOT NULL THEN 1 END) AS audited_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS calls_above_80,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS calls_below_50,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls,
       COUNT(CASE WHEN quality_band = 'Miss' THEN 1 END) AS miss_calls,
       COUNT(CASE WHEN quality_band = 'Good' THEN 1 END) AS good_calls,
       COUNT(CASE WHEN quality_band = 'Excellent' THEN 1 END) AS excellent_calls
     FROM v_call_master_unified_kpi ${where}`, params);
    return summary[0];
}
async function getAgentPerformance(f) {
    const { where, params } = buildFilter(f);
    const [rows] = await db_1.default.execute(`SELECT
       source_agent_name, agent_employee_code, agent_employee_name,
       branch_short_name, process_name,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS calls_above_80,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS calls_below_50,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls,
       COUNT(CASE WHEN quality_band = 'Miss' THEN 1 END) AS miss_count
     FROM v_call_master_unified_kpi ${where}
     GROUP BY source_agent_name, agent_employee_code, agent_employee_name, branch_short_name, process_name
     ORDER BY avg_quality_score DESC`, params);
    return rows;
}
async function getBranchPerformance(f) {
    const { where, params } = buildFilter(f);
    const [rows] = await db_1.default.execute(`SELECT
       branch_short_name,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS calls_above_80,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS calls_below_50,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls
     FROM v_call_master_unified_kpi ${where}
     GROUP BY branch_short_name
     ORDER BY avg_quality_score DESC`, params);
    return rows;
}
async function getProcessPerformance(f) {
    const { where, params } = buildFilter(f);
    const [rows] = await db_1.default.execute(`SELECT
       process_name, business_lob, source_type,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS calls_above_80,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS calls_below_50,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls
     FROM v_call_master_unified_kpi ${where}
     GROUP BY process_name, business_lob, source_type
     ORDER BY avg_quality_score DESC`, params);
    return rows;
}
async function getQualityTrends(f, granularity = 'daily') {
    const { where, params } = buildFilter(f);
    const dateExpr = granularity === 'weekly'
        ? "DATE_FORMAT(call_date, '%Y-%u')"
        : 'call_date';
    const [rows] = await db_1.default.execute(`SELECT
       ${dateExpr} AS period,
       source_type,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS good_plus,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS miss_count
     FROM v_call_master_unified_kpi ${where}
     GROUP BY period, source_type
     ORDER BY period ASC`, params);
    return rows;
}
async function getParameterFailureRates(f) {
    const { where, params } = buildFilter(f);
    // Only inbound has parameter-level scores
    const inboundWhere = where
        ? `${where} AND source_type = 'Inbound'`
        : "WHERE source_type = 'Inbound'";
    const [rows] = await db_1.default.execute(`SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN call_answered_within_5_seconds = 0 THEN 1 ELSE 0 END) AS fail_call_answered,
       SUM(CASE WHEN customer_concern_acknowledged = 0 THEN 1 ELSE 0 END) AS fail_concern_acknowledged,
       SUM(CASE WHEN professionalism_maintained = 0 THEN 1 ELSE 0 END) AS fail_professionalism,
       SUM(CASE WHEN assurance_or_appreciation_provided = 0 THEN 1 ELSE 0 END) AS fail_assurance,
       SUM(CASE WHEN pronunciation_and_clarity = 0 THEN 1 ELSE 0 END) AS fail_clarity,
       SUM(CASE WHEN enthusiasm_and_no_fumbling = 0 THEN 1 ELSE 0 END) AS fail_enthusiasm,
       SUM(CASE WHEN active_listening = 0 THEN 1 ELSE 0 END) AS fail_active_listening,
       SUM(CASE WHEN politeness_and_no_sarcasm = 0 THEN 1 ELSE 0 END) AS fail_politeness,
       SUM(CASE WHEN proper_grammar = 0 THEN 1 ELSE 0 END) AS fail_grammar,
       SUM(CASE WHEN accurate_issue_probing = 0 THEN 1 ELSE 0 END) AS fail_probing,
       SUM(CASE WHEN proper_hold_procedure = 0 THEN 1 ELSE 0 END) AS fail_hold_procedure,
       SUM(CASE WHEN proper_transfer_and_language = 0 THEN 1 ELSE 0 END) AS fail_transfer,
       SUM(CASE WHEN dead_air_under_10_seconds = 0 THEN 1 ELSE 0 END) AS fail_dead_air,
       SUM(CASE WHEN case_escalated_correctly = 0 THEN 1 ELSE 0 END) AS fail_escalation,
       SUM(CASE WHEN address_recorded_completely = 0 THEN 1 ELSE 0 END) AS fail_address_recorded,
       SUM(CASE WHEN correct_and_complete_information = 0 THEN 1 ELSE 0 END) AS fail_correct_info,
       SUM(CASE WHEN upselling_or_offers_suggested = 0 THEN 1 ELSE 0 END) AS fail_upselling,
       SUM(CASE WHEN further_assistance_offered = 0 THEN 1 ELSE 0 END) AS fail_further_assistance,
       SUM(CASE WHEN proper_call_closure = 0 THEN 1 ELSE 0 END) AS fail_call_closure
     FROM v_call_master_inbound ${inboundWhere}`, params);
    if (!rows[0] || rows[0].total === 0)
        return [];
    const total = rows[0].total;
    const paramMap = {
        fail_call_answered: 'Call Answered within 5s',
        fail_concern_acknowledged: 'Customer Concern Acknowledged',
        fail_professionalism: 'Professionalism',
        fail_assurance: 'Assurance / Appreciation',
        fail_clarity: 'Pronunciation & Clarity',
        fail_enthusiasm: 'Enthusiasm',
        fail_active_listening: 'Active Listening',
        fail_politeness: 'Politeness',
        fail_grammar: 'Proper Grammar',
        fail_probing: 'Accurate Issue Probing',
        fail_hold_procedure: 'Hold Procedure',
        fail_transfer: 'Transfer Procedure',
        fail_dead_air: 'Dead Air < 10s',
        fail_escalation: 'Case Escalation',
        fail_address_recorded: 'Address Recorded',
        fail_correct_info: 'Correct & Complete Info',
        fail_upselling: 'Upselling / Offers',
        fail_further_assistance: 'Further Assistance',
        fail_call_closure: 'Proper Call Closure',
    };
    return Object.entries(paramMap).map(([key, label]) => ({
        parameter: label,
        key,
        failures: rows[0][key] || 0,
        total,
        failure_rate: total > 0 ? parseFloat(((rows[0][key] / total) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.failure_rate - a.failure_rate);
}
async function getDailyReport(f) {
    const { where, params } = buildFilter(f);
    const [byBranch] = await db_1.default.execute(`SELECT branch_short_name, source_type,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS good_plus,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS miss_count,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls
     FROM v_call_master_unified_kpi ${where}
     GROUP BY branch_short_name, source_type
     ORDER BY branch_short_name`, params);
    const [byProcess] = await db_1.default.execute(`SELECT process_name, business_lob, source_type,
       COUNT(*) AS total_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       COUNT(CASE WHEN quality_score >= 80 THEN 1 END) AS good_plus,
       COUNT(CASE WHEN quality_score < 50 THEN 1 END) AS miss_count,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS critical_calls
     FROM v_call_master_unified_kpi ${where}
     GROUP BY process_name, business_lob, source_type
     ORDER BY process_name`, params);
    return { by_branch: byBranch, by_process: byProcess };
}
