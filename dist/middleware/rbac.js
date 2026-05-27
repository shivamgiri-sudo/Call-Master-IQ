"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUserScope = loadUserScope;
exports.buildScopeWhereClause = buildScopeWhereClause;
exports.requireRole = requireRole;
const db_1 = __importDefault(require("../config/db"));
async function loadUserScope(req, res, next) {
    if (!req.user) {
        next();
        return;
    }
    try {
        const [rows] = await db_1.default.execute(`SELECT scope_type, branch_short_name, dialdesk_client_id, process_name, business_lob, source_type, employee_code
       FROM user_scope_mapping
       WHERE user_id = ? AND active_status = 1
       LIMIT 1`, [req.user.user_id]);
        if (rows.length === 0) {
            req.scopeFilter = {};
            next();
            return;
        }
        const scope = rows[0];
        const filter = {};
        switch (scope.scope_type) {
            case 'ALL':
                break;
            case 'BRANCH':
                if (scope.branch_short_name)
                    filter.branch_short_name = scope.branch_short_name;
                break;
            case 'PROCESS':
                if (scope.dialdesk_client_id)
                    filter.client_id = scope.dialdesk_client_id;
                if (scope.process_name)
                    filter.process_name = scope.process_name;
                if (scope.business_lob)
                    filter.business_lob = scope.business_lob;
                if (scope.source_type)
                    filter.source_type = scope.source_type;
                break;
            case 'SELF':
                if (scope.employee_code)
                    filter.agent_employee_code = scope.employee_code;
                else if (req.user.employee_code)
                    filter.agent_employee_code = req.user.employee_code;
                break;
        }
        req.scopeFilter = filter;
        next();
    }
    catch (err) {
        next(err);
    }
}
function buildScopeWhereClause(filter, tableAlias = '') {
    const conditions = [];
    const params = [];
    const prefix = tableAlias ? `${tableAlias}.` : '';
    if (filter.client_id) {
        conditions.push(`${prefix}client_id = ?`);
        params.push(filter.client_id);
    }
    if (filter.branch_short_name) {
        conditions.push(`${prefix}branch_short_name = ?`);
        params.push(filter.branch_short_name);
    }
    if (filter.process_name) {
        conditions.push(`${prefix}process_name = ?`);
        params.push(filter.process_name);
    }
    if (filter.business_lob) {
        conditions.push(`${prefix}business_lob = ?`);
        params.push(filter.business_lob);
    }
    if (filter.source_type) {
        conditions.push(`${prefix}source_type = ?`);
        params.push(filter.source_type);
    }
    if (filter.agent_employee_code) {
        conditions.push(`${prefix}agent_employee_code = ?`);
        params.push(filter.agent_employee_code);
    }
    return {
        clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
        params,
    };
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (!roles.includes(req.user.role_code)) {
            res.status(403).json({ error: 'Forbidden: insufficient role' });
            return;
        }
        next();
    };
}
