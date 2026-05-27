"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlerts = getAlerts;
exports.acknowledgeAlert = acknowledgeAlert;
exports.getCriticalCalls = getCriticalCalls;
exports.createAlertFromCall = createAlertFromCall;
const db_1 = __importDefault(require("../config/db"));
const rbac_1 = require("../middleware/rbac");
async function getAlerts(scope, filters) {
    const { severity, alert_type, is_acknowledged, from, to, page = 1, limit = 50 } = filters;
    const conditions = [];
    const params = [];
    const { clause: scopeClause, params: scopeParams } = (0, rbac_1.buildScopeWhereClause)(scope);
    if (scopeClause !== '1=1') {
        conditions.push(scopeClause);
        params.push(...scopeParams);
    }
    if (severity) {
        conditions.push('severity = ?');
        params.push(severity);
    }
    if (alert_type) {
        conditions.push('alert_type = ?');
        params.push(alert_type);
    }
    if (is_acknowledged !== undefined) {
        conditions.push('is_acknowledged = ?');
        params.push(is_acknowledged === '1' ? 1 : 0);
    }
    if (from) {
        conditions.push('created_at >= ?');
        params.push(from);
    }
    if (to) {
        conditions.push('created_at <= ?');
        params.push(to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT * FROM quality_alert ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await db_1.default.execute(`SELECT COUNT(*) AS total FROM quality_alert ${where}`, params);
    return { data: rows, total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) };
}
async function acknowledgeAlert(alert_id, user_id) {
    await db_1.default.execute(`UPDATE quality_alert
     SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW()
     WHERE alert_id = ?`, [user_id, alert_id]);
}
async function getCriticalCalls(scope, filters) {
    const { from, to, client_id, page = 1, limit = 50 } = filters;
    const conditions = ['is_critical_call = 1'];
    const params = [];
    const { clause, params: sp } = (0, rbac_1.buildScopeWhereClause)(scope);
    if (clause !== '1=1') {
        conditions.push(clause);
        params.push(...sp);
    }
    if (client_id) {
        conditions.push('client_id = ?');
        params.push(client_id);
    }
    if (from) {
        conditions.push('call_date >= ?');
        params.push(from);
    }
    if (to) {
        conditions.push('call_date <= ?');
        params.push(to);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT source_call_id, source_type, client_id, process_name, branch_short_name,
            source_agent_name, agent_employee_code, agent_employee_name,
            call_datetime, quality_score, quality_band, alert_severity,
            sensitive_word, overall_fraud_risk_score, fraud_potentiality_percentage
     FROM v_call_master_unified ${where}
     ORDER BY call_datetime DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await db_1.default.execute(`SELECT COUNT(*) AS total FROM v_call_master_unified ${where}`, params);
    return { data: rows, total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) };
}
async function createAlertFromCall(callId, callData) {
    const alerts = [];
    if (callData.is_critical_call) {
        alerts.push({
            alert_type: 'CRITICAL_CALL',
            severity: callData.alert_severity || 'High',
            source_call_id: callId,
            source_type: callData.source_type,
            client_id: callData.client_id,
            process_name: callData.process_name,
            branch_short_name: callData.branch_short_name,
            agent_employee_code: callData.agent_employee_code,
            alert_message: `Critical call detected. Quality: ${callData.quality_score}%`,
        });
    }
    if (callData.fraud_potentiality_percentage && parseFloat(callData.fraud_potentiality_percentage) > 50) {
        alerts.push({
            alert_type: 'FRAUD_FLAG',
            severity: 'High',
            source_call_id: callId,
            source_type: callData.source_type,
            client_id: callData.client_id,
            process_name: callData.process_name,
            branch_short_name: callData.branch_short_name,
            agent_employee_code: callData.agent_employee_code,
            alert_message: `Fraud risk ${callData.fraud_potentiality_percentage}%: ${callData.overall_fraud_risk_score}`,
        });
    }
    if (callData.sensitive_word && callData.sensitive_word !== 'None') {
        alerts.push({
            alert_type: 'SENSITIVE_WORD',
            severity: 'Medium',
            source_call_id: callId,
            source_type: callData.source_type,
            client_id: callData.client_id,
            process_name: callData.process_name,
            branch_short_name: callData.branch_short_name,
            agent_employee_code: callData.agent_employee_code,
            alert_message: `Sensitive word detected: ${callData.sensitive_word}`,
        });
    }
    for (const alert of alerts) {
        await db_1.default.execute(`INSERT INTO quality_alert
         (alert_type, severity, client_id, process_name, branch_short_name,
          agent_employee_code, source_call_id, source_type, alert_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [alert.alert_type, alert.severity, alert.client_id, alert.process_name,
            alert.branch_short_name, alert.agent_employee_code, alert.source_call_id,
            alert.source_type, alert.alert_message]);
    }
}
