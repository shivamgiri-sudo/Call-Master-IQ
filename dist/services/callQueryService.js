"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCallList = getCallList;
exports.getCallDetail = getCallDetail;
exports.getDistinctFilterValues = getDistinctFilterValues;
const db_1 = __importDefault(require("../config/db"));
const rbac_1 = require("../middleware/rbac");
async function getCallList(params) {
    const { scope, from, to, client_id, process_name, business_lob, branch_short_name, source_type, campaign_name, agent_code, quality_band, is_critical, search, page = 1, limit = 50, } = params;
    const conditions = [];
    const queryParams = [];
    // Scope filter (RBAC)
    const { clause: scopeClause, params: scopeParams } = (0, rbac_1.buildScopeWhereClause)(scope);
    if (scopeClause !== '1=1') {
        conditions.push(scopeClause);
        queryParams.push(...scopeParams);
    }
    // User-supplied filters
    if (client_id) {
        conditions.push('client_id = ?');
        queryParams.push(client_id);
    }
    if (process_name) {
        conditions.push('process_name = ?');
        queryParams.push(process_name);
    }
    if (business_lob) {
        conditions.push('business_lob = ?');
        queryParams.push(business_lob);
    }
    if (branch_short_name) {
        conditions.push('branch_short_name = ?');
        queryParams.push(branch_short_name);
    }
    if (source_type) {
        conditions.push('source_type = ?');
        queryParams.push(source_type);
    }
    if (campaign_name) {
        conditions.push('campaign_name = ?');
        queryParams.push(campaign_name);
    }
    if (agent_code) {
        conditions.push('(agent_employee_code = ? OR source_agent_name = ?)');
        queryParams.push(agent_code, agent_code);
    }
    if (quality_band) {
        conditions.push('quality_band = ?');
        queryParams.push(quality_band);
    }
    if (is_critical !== undefined) {
        conditions.push('is_critical_call = ?');
        queryParams.push(is_critical === '1' ? 1 : 0);
    }
    if (from) {
        conditions.push('call_date >= ?');
        queryParams.push(from);
    }
    if (to) {
        conditions.push('call_date <= ?');
        queryParams.push(to);
    }
    if (search) {
        conditions.push('(source_agent_name LIKE ? OR agent_employee_name LIKE ? OR campaign_name LIKE ?)');
        const like = `%${search}%`;
        queryParams.push(like, like, like);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT source_call_id, source_type, client_id, process_name, business_lob,
            branch_short_name, campaign_name, lead_id, mobile_no_masked,
            source_agent_name, agent_employee_code, agent_employee_name,
            call_datetime, call_date, call_time, length_in_sec,
            total_score, max_score, quality_score, quality_band,
            is_critical_call, alert_severity, sensitive_word, overall_fraud_risk_score
     FROM v_call_master_unified
     ${where}
     ORDER BY call_datetime DESC
     LIMIT ? OFFSET ?`, [...queryParams, limit, offset]);
    const [countRows] = await db_1.default.execute(`SELECT COUNT(*) as total FROM v_call_master_unified ${where}`, queryParams);
    return {
        data: rows,
        total: countRows[0].total,
        page,
        limit,
        pages: Math.ceil(countRows[0].total / limit),
    };
}
async function getCallDetail(source_call_id, scope) {
    const { clause: scopeClause, params: scopeParams } = (0, rbac_1.buildScopeWhereClause)(scope);
    const scopePart = scopeClause !== '1=1' ? `AND ${scopeClause}` : '';
    const [rows] = await db_1.default.execute(`SELECT *
     FROM v_call_master_unified
     WHERE source_call_id = ? ${scopePart}
     LIMIT 1`, [source_call_id, ...scopeParams]);
    return rows[0] || null;
}
async function getDistinctFilterValues(scope) {
    const { clause, params } = (0, rbac_1.buildScopeWhereClause)(scope);
    const where = clause !== '1=1' ? `WHERE ${clause}` : '';
    const [clients] = await db_1.default.execute(`SELECT DISTINCT client_id FROM v_call_master_unified ${where} ORDER BY client_id`, params);
    const [processes] = await db_1.default.execute(`SELECT DISTINCT process_name, business_lob, source_type FROM v_call_master_unified ${where} ORDER BY process_name`, params);
    const [branches] = await db_1.default.execute(`SELECT DISTINCT branch_short_name FROM v_call_master_unified ${where} ORDER BY branch_short_name`, params);
    const [campaigns] = await db_1.default.execute(`SELECT DISTINCT campaign_name FROM v_call_master_unified ${where} ORDER BY campaign_name`, params);
    return { clients, processes, branches, campaigns };
}
