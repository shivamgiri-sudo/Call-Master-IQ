"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDailySnapshot = computeDailySnapshot;
exports.runSnapshotForYesterday = runSnapshotForYesterday;
const db_1 = __importDefault(require("../config/db"));
async function computeDailySnapshot(date) {
    // Delete any existing snapshot for this date first (idempotent)
    await db_1.default.execute(`DELETE FROM daily_performance_snapshot WHERE snapshot_date = ?`, [date]);
    // Aggregate inbound calls
    await db_1.default.execute(`INSERT INTO daily_performance_snapshot
       (snapshot_date, client_id, process_name, business_lob, branch_short_name, source_type,
        agent_employee_code, total_calls, audited_calls, avg_quality_score,
        calls_above_80, calls_below_50, critical_calls, fraud_flag_calls,
        fail_call_answered, fail_concern_acknowledged, fail_professionalism,
        fail_assurance, fail_clarity, fail_enthusiasm, fail_active_listening,
        fail_politeness, fail_grammar, fail_probing, fail_hold_procedure,
        fail_transfer, fail_dead_air, fail_escalation, fail_address_recorded,
        fail_correct_info, fail_upselling, fail_further_assistance, fail_call_closure)
     SELECT
       ? AS snapshot_date,
       client_id, COALESCE(process_name,''), COALESCE(business_lob,''),
       COALESCE(branch_short_name,''), source_type,
       COALESCE(agent_employee_code,'') AS agent_employee_code,
       COUNT(*) AS total_calls,
       COUNT(CASE WHEN quality_score IS NOT NULL THEN 1 END) AS audited_calls,
       ROUND(AVG(quality_score), 2) AS avg_quality_score,
       SUM(CASE WHEN quality_score >= 80 THEN 1 ELSE 0 END),
       SUM(CASE WHEN quality_score < 50 THEN 1 ELSE 0 END),
       SUM(CASE WHEN is_critical_call = 1 THEN 1 ELSE 0 END),
       SUM(CASE WHEN (fraud_potentiality_percentage IS NOT NULL
                      AND fraud_potentiality_percentage != 'None'
                      AND CAST(fraud_potentiality_percentage AS DECIMAL) > 50) THEN 1 ELSE 0 END),
       SUM(CASE WHEN call_answered_within_5_seconds = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN customer_concern_acknowledged = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN professionalism_maintained = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN assurance_or_appreciation_provided = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN pronunciation_and_clarity = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN enthusiasm_and_no_fumbling = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN active_listening = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN politeness_and_no_sarcasm = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN proper_grammar = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN accurate_issue_probing = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN proper_hold_procedure = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN proper_transfer_and_language = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN dead_air_under_10_seconds = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN case_escalated_correctly = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN address_recorded_completely = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN correct_and_complete_information = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN upselling_or_offers_suggested = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN further_assistance_offered = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN proper_call_closure = 0 THEN 1 ELSE 0 END)
     FROM v_call_master_inbound
     WHERE call_date = ?
     GROUP BY client_id, process_name, business_lob, branch_short_name, source_type, agent_employee_code`, [date, date]);
    // Aggregate outbound calls (no parameter-level scores — just totals)
    await db_1.default.execute(`INSERT INTO daily_performance_snapshot
       (snapshot_date, client_id, process_name, business_lob, branch_short_name, source_type,
        agent_employee_code, total_calls, critical_calls)
     SELECT
       ? AS snapshot_date,
       client_id, COALESCE(process_name,''), COALESCE(business_lob,''),
       COALESCE(branch_short_name,''), source_type,
       COALESCE(agent_employee_code,'') AS agent_employee_code,
       COUNT(*) AS total_calls,
       SUM(CASE WHEN is_critical_call = 1 THEN 1 ELSE 0 END) AS critical_calls
     FROM v_call_master_outbound
     WHERE call_date = ?
     GROUP BY client_id, process_name, business_lob, branch_short_name, source_type, agent_employee_code
     ON DUPLICATE KEY UPDATE
       total_calls = total_calls + VALUES(total_calls),
       critical_calls = critical_calls + VALUES(critical_calls)`, [date, date]);
    // Generate quality dip alerts — compare vs previous 7-day avg
    await generateQualityDipAlerts(date);
    return { date, status: 'done' };
}
async function generateQualityDipAlerts(date) {
    const [snapshots] = await db_1.default.execute(`SELECT client_id, process_name, branch_short_name, source_type,
            avg_quality_score AS today_score
     FROM daily_performance_snapshot
     WHERE snapshot_date = ? AND avg_quality_score IS NOT NULL`, [date]);
    for (const snap of snapshots) {
        const [prev] = await db_1.default.execute(`SELECT AVG(avg_quality_score) AS prev_avg
       FROM daily_performance_snapshot
       WHERE snapshot_date >= DATE_SUB(?, INTERVAL 7 DAY)
         AND snapshot_date < ?
         AND client_id = ? AND process_name = ?
         AND branch_short_name = ? AND source_type = ?`, [date, date, snap.client_id, snap.process_name, snap.branch_short_name, snap.source_type]);
        const prevAvg = prev[0]?.prev_avg;
        if (!prevAvg)
            continue;
        const dip = parseFloat(prevAvg) - parseFloat(snap.today_score);
        if (dip >= 5) {
            await db_1.default.execute(`INSERT INTO quality_alert
           (alert_type, severity, client_id, process_name, branch_short_name, source_type, alert_message)
         VALUES ('QUALITY_DIP', ?, ?, ?, ?, ?, ?)`, [
                dip >= 10 ? 'High' : 'Medium',
                snap.client_id, snap.process_name, snap.branch_short_name, snap.source_type,
                `Quality dip of ${dip.toFixed(1)}% on ${date}. Today: ${snap.today_score}%, 7-day avg: ${parseFloat(prevAvg).toFixed(1)}%`,
            ]);
        }
    }
}
async function runSnapshotForYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return computeDailySnapshot(dateStr);
}
