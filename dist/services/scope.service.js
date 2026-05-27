"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScopeCondition = getScopeCondition;
const db_1 = require("../config/db");
async function getScopeCondition(user) {
    if (!user || ['CEO', 'TQ_HEAD', 'ADMIN'].includes(user.role_code)) {
        return { whereSql: '', params: [] };
    }
    const [rows] = await db_1.db.query(`SELECT branch_short_name, process_name, employee_code
     FROM user_scope_mapping
     WHERE user_id = ? AND active_status = 1`, [user.user_id]);
    if (!rows.length)
        return { whereSql: ' AND 1=0 ', params: [] };
    const branches = [...new Set(rows.map((r) => r.branch_short_name).filter(Boolean))];
    const processes = [...new Set(rows.map((r) => r.process_name).filter(Boolean))];
    const employees = [...new Set(rows.map((r) => r.employee_code).filter(Boolean))];
    const ph = (a) => a.map(() => '?').join(',');
    if (user.role_code === 'BRANCH_HEAD') {
        return branches.length
            ? { whereSql: ` AND branch_short_name IN (${ph(branches)}) `, params: branches }
            : { whereSql: ' AND 1=0 ', params: [] };
    }
    if (user.role_code === 'PROCESS_MANAGER') {
        const parts = [];
        const params = [];
        if (branches.length) {
            parts.push(`branch_short_name IN (${ph(branches)})`);
            params.push(...branches);
        }
        if (processes.length) {
            parts.push(`process_name IN (${ph(processes)})`);
            params.push(...processes);
        }
        return parts.length
            ? { whereSql: ' AND ' + parts.join(' AND '), params }
            : { whereSql: ' AND 1=0 ', params: [] };
    }
    if (user.role_code === 'ANALYST') {
        return employees.length
            ? { whereSql: ` AND agent_employee_code IN (${ph(employees)}) `, params: employees }
            : { whereSql: ' AND 1=0 ', params: [] };
    }
    return { whereSql: ' AND 1=0 ', params: [] };
}
