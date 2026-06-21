import pool from '../config/db';

export const ADMIN_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
  'TQ_HEAD',
  'HO_QA',
  'CEO',
] as const;

const PRODUCT_ROLE_MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS', 'VIEW_ADMIN_PANEL', 'MANAGE_USERS', 'MANAGE_ROLE_ACCESS'],
  ADMIN: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS', 'VIEW_ADMIN_PANEL', 'MANAGE_USERS', 'MANAGE_ROLE_ACCESS'],
  CEO: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_ANALYST_PERFORMANCE'],
  HO_QA: ['VIEW_QUALITY_DASHBOARD', 'VIEW_RISK_QUEUE', 'VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS'],
  TQ_HEAD: ['VIEW_QUALITY_DASHBOARD', 'VIEW_RISK_QUEUE', 'VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS'],
  HO_OPERATIONS: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS'],
  MANAGER: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS'],
  QUALITY_MANAGER: ['VIEW_QUALITY_DASHBOARD', 'VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS'],
  OPERATIONS_MANAGER: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS'],
  PROCESS_MANAGER: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS'],
  BRANCH_MANAGER: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS'],
  TEAM_LEADER: ['VIEW_ANALYST_PERFORMANCE', 'VIEW_TNI_HEATMAP', 'VIEW_EVIDENCE', 'VIEW_SETTINGS'],
  QUALITY_ANALYST: ['VIEW_EVIDENCE', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SETTINGS'],
  TRAINER: ['VIEW_TNI_HEATMAP', 'VIEW_ANALYST_PERFORMANCE', 'VIEW_EVIDENCE', 'VIEW_SETTINGS'],
  HR_ADMIN: ['VIEW_SETTINGS', 'VIEW_HR_ADMIN'],
  PAYROLL_ADMIN: ['VIEW_SETTINGS', 'VIEW_PAYROLL_ADMIN'],
  ANALYST: ['VIEW_ANALYST_PERFORMANCE', 'VIEW_SETTINGS', 'VIEW_SELF_ONLY'],
  VIEWER: ['VIEW_EXECUTIVE_DASHBOARD', 'VIEW_QUALITY_DASHBOARD', 'VIEW_SALES_FUNNEL', 'VIEW_RISK_QUEUE', 'VIEW_SETTINGS'],
};

export async function listSafeUsers(query: { search?: string; role?: string; status?: string; limit?: number }) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.role) {
    conditions.push('u.role_code = ?');
    params.push(query.role);
  }
  if (query.status === 'active') conditions.push('u.active_status = 1');
  if (query.status === 'inactive') conditions.push('u.active_status = 0');
  if (query.search) {
    conditions.push('(u.full_name LIKE ? OR u.login_id LIKE ? OR u.email LIKE ? OR u.employee_code LIKE ?)');
    const q = `%${query.search}%`;
    params.push(q, q, q, q);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute<any[]>(
    `SELECT
       u.user_id AS id,
       u.full_name AS name,
       u.email,
       u.login_id AS loginId,
       u.role_code AS role,
       r.role_name AS roleName,
       CASE WHEN u.active_status = 1 AND COALESCE(u.account_locked, 0) = 0 THEN 'active'
            WHEN COALESCE(u.account_locked, 0) = 1 THEN 'locked'
            ELSE 'inactive' END AS status,
       u.branch_short_name AS branch,
       us.process_name AS process,
       u.created_at AS createdAt,
       u.last_login_at AS lastLoginAt
     FROM user_master u
     LEFT JOIN role_master r ON r.role_code = u.role_code
     LEFT JOIN user_scope_mapping us ON us.user_id = u.user_id AND us.active_status = 1
     ${where}
     ORDER BY u.full_name, u.login_id
     LIMIT ${limit}`,
    params
  );

  return {
    users: rows.map(normalizeUser),
    total: rows.length,
    source: 'user_master',
    hiddenFields: ['password_hash', 'failed_login_attempts', 'reset_token', 'jwt', 'secret'],
  };
}

export async function getSafeUserById(id: string) {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       u.user_id AS id,
       u.full_name AS name,
       u.email,
       u.login_id AS loginId,
       u.role_code AS role,
       r.role_name AS roleName,
       CASE WHEN u.active_status = 1 AND COALESCE(u.account_locked, 0) = 0 THEN 'active'
            WHEN COALESCE(u.account_locked, 0) = 1 THEN 'locked'
            ELSE 'inactive' END AS status,
       u.branch_short_name AS branch,
       us.process_name AS process,
       u.created_at AS createdAt,
       u.last_login_at AS lastLoginAt
     FROM user_master u
     LEFT JOIN role_master r ON r.role_code = u.role_code
     LEFT JOIN user_scope_mapping us ON us.user_id = u.user_id AND us.active_status = 1
     WHERE u.user_id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}

export async function listRoles() {
  const [rows] = await pool.execute<any[]>(
    `SELECT role_code AS role, role_name AS name
     FROM role_master
     ORDER BY role_code`
  );
  return {
    roles: rows.map(r => ({
      role: String(r.role),
      name: String(r.name || r.role),
      permissions: PRODUCT_ROLE_MATRIX[String(r.role)] || PRODUCT_ROLE_MATRIX.VIEWER,
    })),
    source: 'role_master + product role matrix',
  };
}

export function listPermissions() {
  const permissions = Array.from(new Set(Object.values(PRODUCT_ROLE_MATRIX).flat())).sort();
  return {
    permissions: permissions.map(permission => ({
      permission,
      description: permission.toLowerCase().replace(/_/g, ' '),
    })),
    source: 'product role matrix',
  };
}

export function getRoleMatrix() {
  return {
    roles: Object.entries(PRODUCT_ROLE_MATRIX).map(([role, permissions]) => ({
      role,
      permissions,
      permissionCount: permissions.length,
      accessLevel: permissions.includes('MANAGE_USERS') ? 'admin' : permissions.includes('VIEW_EXECUTIVE_DASHBOARD') ? 'dashboard' : 'scoped',
    })),
    source: 'product role matrix',
  };
}

function normalizeUser(row: any) {
  return {
    id: row.id,
    name: row.name || row.loginId || 'Unknown',
    email: row.email || null,
    loginId: row.loginId || null,
    role: row.role || 'VIEWER',
    roleName: row.roleName || row.role || 'Viewer',
    status: row.status || 'inactive',
    branch: row.branch || null,
    process: row.process || null,
    createdAt: row.createdAt || null,
    lastLoginAt: row.lastLoginAt || null,
  };
}
