import { db } from '../config/db';
import type { AuthUser } from '../middleware/rbac';

export async function getScopeCondition(user?: AuthUser): Promise<{ whereSql: string; params: any[] }> {
  if (!user || ['CEO', 'TQ_HEAD', 'ADMIN'].includes(user.role_code)) {
    return { whereSql: '', params: [] as any[] };
  }

  const [rows]: any = await db.query(
    `SELECT branch_short_name, process_name, employee_code
     FROM user_scope_mapping
     WHERE user_id = ? AND active_status = 1`,
    [user.user_id]
  );

  if (!rows.length) return { whereSql: ' AND 1=0 ', params: [] as any[] };

  const branches: any[] = [...new Set(rows.map((r: any) => r.branch_short_name).filter(Boolean))];
  const processes: any[] = [...new Set(rows.map((r: any) => r.process_name).filter(Boolean))];
  const employees: any[] = [...new Set(rows.map((r: any) => r.employee_code).filter(Boolean))];

  const ph = (a: any[]) => a.map(() => '?').join(',');

  if (user.role_code === 'BRANCH_HEAD') {
    return branches.length
      ? { whereSql: ` AND branch_short_name IN (${ph(branches)}) `, params: branches }
      : { whereSql: ' AND 1=0 ', params: [] };
  }

  if (user.role_code === 'PROCESS_MANAGER') {
    const parts: string[] = [];
    const params: any[] = [];
    if (branches.length) { parts.push(`branch_short_name IN (${ph(branches)})`); params.push(...branches); }
    if (processes.length) { parts.push(`process_name IN (${ph(processes)})`); params.push(...processes); }
    return parts.length
      ? { whereSql: ' AND ' + parts.join(' AND '), params }
      : { whereSql: ' AND 1=0 ', params: [] };
  }

  if (user.role_code === 'ANALYST') {
    return employees.length
      ? { whereSql: ` AND agent_employee_code IN (${ph(employees)}) `, params: employees }
      : { whereSql: ' AND 1=0 ', params: [] };
  }

  return { whereSql: ' AND 1=0 ', params: [] as any[] };
}
