// src/callmaster/services/adminService.ts
import db, { pingDb } from '../../config/db';
import { getExternalPool } from '../../config/dbExternal';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function qDb(sql: string, params: any[] = []): Promise<any[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows as any[];
}

async function execDb(sql: string, params: any[] = []): Promise<any> {
  const [result] = await (db as any).execute(sql, params);
  return result;
}

// Build SET clause dynamically, returns { clause, values }
function buildSetClause(data: Record<string, any>): { clause: string; values: any[] } {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (keys.length === 0) throw new Error('No fields to update');
  const clause = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = keys.map((k) => data[k]);
  return { clause, values };
}

// ===========================================================================
// USERS  (cm_users)
// ===========================================================================

export async function listUsers() {
  return qDb(
    `SELECT user_id, username, full_name, role, branch_ids, process_ids,
            employee_code, active, created_at
     FROM cm_users
     ORDER BY created_at DESC`,
  );
}

export async function getUserById(userId: number) {
  const rows = await qDb(
    `SELECT user_id, username, full_name, role, branch_ids, process_ids,
            employee_code, active, created_at
     FROM cm_users
     WHERE user_id = ?`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function createUser(data: {
  username: string;
  password: string;
  full_name: string;
  role: string;
  branch_ids: any;
  process_ids: any;
  employee_code?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const branchIds = typeof data.branch_ids === 'string' ? data.branch_ids : JSON.stringify(data.branch_ids);
  const processIds = typeof data.process_ids === 'string' ? data.process_ids : JSON.stringify(data.process_ids);

  const result = await execDb(
    `INSERT INTO cm_users
       (username, password_hash, full_name, role, branch_ids, process_ids, employee_code, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [data.username, passwordHash, data.full_name, data.role, branchIds, processIds, data.employee_code ?? null],
  );
  return { insertId: result.insertId };
}

export async function updateUser(
  userId: number,
  data: Partial<{
    full_name: string;
    role: string;
    branch_ids: any;
    process_ids: any;
    employee_code: string;
    active: number;
  }>,
) {
  const normalized: Record<string, any> = { ...data };
  if (normalized.branch_ids !== undefined && typeof normalized.branch_ids !== 'string') {
    normalized.branch_ids = JSON.stringify(normalized.branch_ids);
  }
  if (normalized.process_ids !== undefined && typeof normalized.process_ids !== 'string') {
    normalized.process_ids = JSON.stringify(normalized.process_ids);
  }

  const { clause, values } = buildSetClause(normalized);
  const result = await execDb(
    `UPDATE cm_users SET ${clause} WHERE user_id = ?`,
    [...values, userId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deactivateUser(userId: number) {
  const result = await execDb(
    `UPDATE cm_users SET active = 0 WHERE user_id = ?`,
    [userId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteUser(userId: number) {
  const result = await execDb(
    `DELETE FROM cm_users WHERE user_id = ?`,
    [userId],
  );
  return { affectedRows: result.affectedRows };
}

export async function resetUserPassword(userId: number, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const result = await execDb(
    `UPDATE cm_users SET password_hash = ? WHERE user_id = ?`,
    [passwordHash, userId],
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// EMPLOYEES  (employee_mapping_master)
// ===========================================================================

export async function listEmployees(filters: { branch?: string; process?: string; active?: number } = {}) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.branch) {
    conditions.push('branch = ?');
    params.push(filters.branch);
  }
  if (filters.process) {
    conditions.push('process_name = ?');
    params.push(filters.process);
  }
  if (filters.active !== undefined) {
    conditions.push('active_status = ?');
    params.push(filters.active);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return qDb(
    `SELECT emp_id, employee_code, employee_name, process_name, branch,
            designation, team_leader_code, active_status, created_at
     FROM employee_mapping_master
     ${where}
     ORDER BY employee_name`,
    params,
  );
}

export async function createEmployee(data: {
  employee_code: string;
  employee_name: string;
  process_name: string;
  branch: string;
  designation?: string;
  team_leader_code?: string;
}) {
  const result = await execDb(
    `INSERT INTO employee_mapping_master
       (employee_code, employee_name, process_name, branch, designation, team_leader_code, active_status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      data.employee_code,
      data.employee_name,
      data.process_name,
      data.branch,
      data.designation ?? null,
      data.team_leader_code ?? null,
    ],
  );
  return { insertId: result.insertId };
}

export async function updateEmployee(
  empId: number,
  data: Partial<{
    employee_name: string;
    process_name: string;
    branch: string;
    designation: string;
    team_leader_code: string;
    active_status: number;
  }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE employee_mapping_master SET ${clause} WHERE emp_id = ?`,
    [...values, empId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteEmployee(empId: number) {
  const result = await execDb(
    `DELETE FROM employee_mapping_master WHERE emp_id = ?`,
    [empId],
  );
  return { affectedRows: result.affectedRows };
}

export async function bulkImportEmployees(
  rows: Array<{
    employee_code: string;
    employee_name: string;
    process_name: string;
    branch: string;
    designation?: string;
    team_leader_code?: string;
  }>,
) {
  if (rows.length === 0) return { affectedRows: 0 };

  const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, 1)').join(', ');
  const values: any[] = [];
  for (const r of rows) {
    values.push(r.employee_code, r.employee_name, r.process_name, r.branch, r.designation ?? null, r.team_leader_code ?? null);
  }

  const result = await execDb(
    `INSERT IGNORE INTO employee_mapping_master
       (employee_code, employee_name, process_name, branch, designation, team_leader_code, active_status)
     VALUES ${placeholders}`,
    values,
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// AGENT ALIASES  (employee_source_alias — column is `source_alias`)
// ===========================================================================

export async function listAliases(processName?: string) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (processName) {
    conditions.push('esa.process_name = ?');
    params.push(processName);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return qDb(
    `SELECT esa.alias_id, esa.source_alias, esa.employee_code,
            esa.process_name, esa.active_status, esa.created_at,
            emm.employee_name
     FROM employee_source_alias esa
     LEFT JOIN employee_mapping_master emm
       ON esa.employee_code = emm.employee_code
       AND esa.process_name = emm.process_name
     ${where}
     ORDER BY esa.process_name, esa.source_alias`,
    params,
  );
}

export async function createAlias(data: {
  source_alias: string;
  employee_code: string;
  process_name: string;
}) {
  const result = await execDb(
    `INSERT INTO employee_source_alias (source_alias, employee_code, process_name, active_status)
     VALUES (?, ?, ?, 1)`,
    [data.source_alias, data.employee_code, data.process_name],
  );
  return { insertId: result.insertId };
}

export async function updateAlias(aliasId: number, data: { employee_code: string; process_name: string }) {
  const result = await execDb(
    `UPDATE employee_source_alias
     SET employee_code = ?, process_name = ?
     WHERE alias_id = ?`,
    [data.employee_code, data.process_name, aliasId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteAlias(aliasId: number) {
  const result = await execDb(
    `DELETE FROM employee_source_alias WHERE alias_id = ?`,
    [aliasId],
  );
  return { affectedRows: result.affectedRows };
}

export async function bulkImportAliases(
  rows: Array<{
    source_alias: string;
    employee_code: string;
    process_name: string;
  }>,
) {
  if (rows.length === 0) return { affectedRows: 0 };

  const placeholders = rows.map(() => '(?, ?, ?, 1)').join(', ');
  const values: any[] = [];
  for (const r of rows) {
    values.push(r.source_alias, r.employee_code, r.process_name);
  }

  const result = await execDb(
    `INSERT IGNORE INTO employee_source_alias (source_alias, employee_code, process_name, active_status)
     VALUES ${placeholders}`,
    values,
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// PROCESSES  (process_mapping_master)
// Note: target_cq_pct column may not exist yet — query will error at runtime
//       until the column is added via ALTER TABLE.
// ===========================================================================

export async function listProcesses() {
  return qDb(
    `SELECT process_id, process_name, business_lob, branch, source_type,
            dialdesk_client_id, active_status,
            NULL AS target_cq_pct
     FROM process_mapping_master
     ORDER BY process_name`,
  );
}

export async function createProcess(data: {
  process_name: string;
  business_lob?: string;
  branch?: string;
  source_type?: string;
  dialdesk_client_id?: string;
  active_status?: number;
}) {
  const result = await execDb(
    `INSERT INTO process_mapping_master
       (process_name, business_lob, branch, source_type, dialdesk_client_id, active_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.process_name,
      data.business_lob ?? null,
      data.branch ?? null,
      data.source_type ?? null,
      data.dialdesk_client_id ?? null,
      data.active_status ?? 1,
    ],
  );
  return { insertId: result.insertId };
}

export async function updateProcess(
  processId: number,
  data: Partial<{
    process_name: string;
    business_lob: string;
    branch: string;
    source_type: string;
    dialdesk_client_id: string;
    active_status: number;
  }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE process_mapping_master SET ${clause} WHERE process_id = ?`,
    [...values, processId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteProcess(processId: number) {
  const result = await execDb(
    `DELETE FROM process_mapping_master WHERE process_id = ?`,
    [processId],
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// EXCLUSION RULES  (dashboard_exclusion_rules)
// Actual schema: source_db, source_table, source_type, client_id,
//                campaign_id, exclusion_reason, active_status, created_by
// ===========================================================================

export async function listExclusionRules() {
  return qDb(
    `SELECT exclusion_id, source_db, source_table, source_type, client_id,
            campaign_id, exclusion_reason, active_status, created_by, created_at
     FROM dashboard_exclusion_rules
     ORDER BY created_at DESC`,
  );
}

export async function createExclusionRule(data: {
  source_db: string;
  source_table: string;
  source_type: string;
  client_id: string;
  campaign_id?: string;
  exclusion_reason: string;
  created_by: string;
}) {
  const result = await execDb(
    `INSERT INTO dashboard_exclusion_rules
       (source_db, source_table, source_type, client_id, campaign_id,
        exclusion_reason, active_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      data.source_db,
      data.source_table,
      data.source_type,
      data.client_id,
      data.campaign_id ?? null,
      data.exclusion_reason,
      data.created_by,
    ],
  );
  return { insertId: result.insertId };
}

export async function updateExclusionRule(
  ruleId: number,
  data: Partial<{ exclusion_reason: string; active_status: number }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE dashboard_exclusion_rules SET ${clause} WHERE exclusion_id = ?`,
    [...values, ruleId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteExclusionRule(ruleId: number) {
  const result = await execDb(
    `DELETE FROM dashboard_exclusion_rules WHERE exclusion_id = ?`,
    [ruleId],
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// COACHING QUEUE  (call_coaching_queue)
// ===========================================================================

export async function listCoachingQueue(
  filters: {
    status?: string;
    process?: string;
    priority?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.process) {
    conditions.push('process_name = ?');
    params.push(filters.process);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  // Get total count
  const countRows = await qDb(
    `SELECT COUNT(*) AS total FROM call_coaching_queue ${where}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);

  // Get paged data
  const rows = await qDb(
    `SELECT coaching_id, source_type, source_call_id, branch_short_name,
            process_name, agent_employee_code, assigned_to, coaching_title,
            coaching_reason, priority, status, due_date, created_at, closed_at
     FROM call_coaching_queue
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total, page, limit, data: rows };
}

export async function createCoachingEntry(data: {
  source_type?: string;
  source_call_id?: string;
  branch_short_name?: string;
  process_name?: string;
  agent_employee_code?: string;
  assigned_to?: string;
  coaching_title?: string;
  coaching_reason?: string;
  priority?: string;
  due_date?: string;
}) {
  const result = await execDb(
    `INSERT INTO call_coaching_queue
       (source_type, source_call_id, branch_short_name, process_name,
        agent_employee_code, assigned_to, coaching_title, coaching_reason,
        priority, status, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?)`,
    [
      data.source_type ?? null,
      data.source_call_id ?? null,
      data.branch_short_name ?? null,
      data.process_name ?? null,
      data.agent_employee_code ?? null,
      data.assigned_to ?? null,
      data.coaching_title ?? null,
      data.coaching_reason ?? null,
      data.priority ?? 'Normal',
      data.due_date ?? null,
    ],
  );
  return { insertId: result.insertId };
}

export async function updateCoachingEntry(
  coachingId: number,
  data: Partial<{
    assigned_to: string;
    coaching_title: string;
    coaching_reason: string;
    priority: string;
    status: string;
    due_date: string;
    closed_at: string;
  }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE call_coaching_queue SET ${clause} WHERE coaching_id = ?`,
    [...values, coachingId],
  );
  return { affectedRows: result.affectedRows };
}

export async function bulkCloseCoaching(coachingIds: number[]) {
  if (coachingIds.length === 0) return { affectedRows: 0 };
  const placeholders = coachingIds.map(() => '?').join(', ');
  const result = await execDb(
    `UPDATE call_coaching_queue
     SET status = 'Closed', closed_at = NOW()
     WHERE coaching_id IN (${placeholders})`,
    coachingIds,
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// CALIBRATION SESSIONS  (calibration_session)
// ===========================================================================

export async function listCalibrationSessions(
  filters: {
    process_name?: string;
    session_status?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.process_name) {
    conditions.push('process_name = ?');
    params.push(filters.process_name);
  }
  if (filters.session_status) {
    conditions.push('session_status = ?');
    params.push(filters.session_status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const countRows = await qDb(
    `SELECT COUNT(*) AS total FROM calibration_session ${where}`,
    params,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await qDb(
    `SELECT session_id, process_name, session_date, facilitator_name,
            session_status, participant_count, notes, created_at
     FROM calibration_session
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total, page, limit, data: rows };
}

export async function createCalibrationSession(data: {
  process_name: string;
  session_date: string;
  facilitator_name: string;
  notes?: string;
}) {
  const result = await execDb(
    `INSERT INTO calibration_session
       (process_name, session_date, facilitator_name, session_status, notes)
     VALUES (?, ?, ?, 'open', ?)`,
    [data.process_name, data.session_date, data.facilitator_name, data.notes ?? null],
  );
  return { insertId: result.insertId };
}

export async function updateCalibrationSession(
  sessionId: number,
  data: Partial<{
    process_name: string;
    session_date: string;
    facilitator_name: string;
    session_status: string;
    participant_count: number;
    notes: string;
  }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE calibration_session SET ${clause} WHERE session_id = ?`,
    [...values, sessionId],
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// CALIBRATION CALLS  (calibration_call)
// Columns: calibration_id, session_id, source_call_id, agent_employee_code,
//          manual_quality_percentage, ai_quality_percentage, call_notes
// ===========================================================================

export async function listCalibrationCalls(sessionId: number) {
  return qDb(
    `SELECT cc.calibration_id, cc.session_id, cc.source_call_id,
            cc.agent_employee_code,
            emm.employee_name AS agent_employee_name,
            cc.manual_quality_percentage,
            cc.ai_quality_percentage,
            cc.call_notes,
            cc.created_at
     FROM calibration_call cc
     LEFT JOIN employee_mapping_master emm
       ON cc.agent_employee_code = emm.employee_code
     WHERE cc.session_id = ?
     ORDER BY cc.created_at`,
    [sessionId],
  );
}

export async function addCalibrationCall(data: {
  session_id: number;
  source_call_id: string;
  agent_employee_code: string;
  manual_quality_percentage: number;
  ai_quality_percentage?: number;
  call_notes?: string;
}) {
  const result = await execDb(
    `INSERT INTO calibration_call
       (session_id, source_call_id, agent_employee_code,
        manual_quality_percentage, ai_quality_percentage, call_notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.session_id,
      data.source_call_id,
      data.agent_employee_code,
      data.manual_quality_percentage,
      data.ai_quality_percentage ?? null,
      data.call_notes ?? null,
    ],
  );
  return { insertId: result.insertId };
}

// ===========================================================================
// AUDIT PROMPTS  (audit_prompt_config)
// ===========================================================================

export async function listAuditPrompts(processName?: string) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (processName) {
    conditions.push('process_name = ?');
    params.push(processName);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return qDb(
    `SELECT prompt_id, process_name, source_type, parameter_name,
            max_marks, prompt_text, active, created_at
     FROM audit_prompt_config
     ${where}
     ORDER BY process_name, parameter_name`,
    params,
  );
}

export async function createAuditPrompt(data: {
  process_name: string;
  source_type?: string;
  parameter_name: string;
  max_marks?: number;
  prompt_text: string;
}) {
  const result = await execDb(
    `INSERT INTO audit_prompt_config
       (process_name, source_type, parameter_name, max_marks, prompt_text, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      data.process_name,
      data.source_type ?? null,
      data.parameter_name,
      data.max_marks ?? null,
      data.prompt_text,
    ],
  );
  return { insertId: result.insertId };
}

export async function updateAuditPrompt(
  promptId: number,
  data: Partial<{
    process_name: string;
    source_type: string;
    parameter_name: string;
    max_marks: number;
    prompt_text: string;
    active: number;
  }>,
) {
  const { clause, values } = buildSetClause(data as Record<string, any>);
  const result = await execDb(
    `UPDATE audit_prompt_config SET ${clause} WHERE prompt_id = ?`,
    [...values, promptId],
  );
  return { affectedRows: result.affectedRows };
}

export async function deleteAuditPrompt(promptId: number) {
  const result = await execDb(
    `DELETE FROM audit_prompt_config WHERE prompt_id = ?`,
    [promptId],
  );
  return { affectedRows: result.affectedRows };
}

// ===========================================================================
// SYSTEM HEALTH
// ===========================================================================

export async function systemHealth() {
  // Ping Shivamgiri (internal) DB
  let dbInternal: any = null;
  let dbInternalError: string | null = null;
  try {
    dbInternal = await pingDb();
  } catch (err: any) {
    dbInternalError = err?.message ?? 'Unknown error';
  }

  // Ping external DB
  let dbExternal: any = null;
  let dbExternalError: string | null = null;
  try {
    const extPool = getExternalPool();
    const [rows]: any = await extPool.query(
      'SELECT DATABASE() current_database, USER() login_user, NOW() server_time',
    );
    dbExternal = rows[0];
  } catch (err: any) {
    dbExternalError = err?.message ?? 'Unknown error';
  }

  // Counts
  let totalUsers = 0;
  let activeProcesses = 0;
  let openCoachingItems = 0;

  try {
    const rows = await qDb('SELECT COUNT(*) AS cnt FROM cm_users');
    totalUsers = Number(rows[0]?.cnt ?? 0);
  } catch (_) {
    // ignore
  }

  try {
    const rows = await qDb(
      "SELECT COUNT(*) AS cnt FROM process_mapping_master WHERE active_status = 1",
    );
    activeProcesses = Number(rows[0]?.cnt ?? 0);
  } catch (_) {
    // ignore
  }

  try {
    const rows = await qDb(
      "SELECT COUNT(*) AS cnt FROM call_coaching_queue WHERE status = 'Open'",
    );
    openCoachingItems = Number(rows[0]?.cnt ?? 0);
  } catch (_) {
    // ignore
  }

  return {
    status: dbInternalError ? 'degraded' : 'ok',
    databases: {
      internal: {
        connected: !dbInternalError,
        info: dbInternal,
        error: dbInternalError,
      },
      external: {
        connected: !dbExternalError,
        info: dbExternal,
        error: dbExternalError,
      },
    },
    counts: {
      totalUsers,
      activeProcesses,
      openCoachingItems,
    },
    timestamp: new Date().toISOString(),
  };
}
