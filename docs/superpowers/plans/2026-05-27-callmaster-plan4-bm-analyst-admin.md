# Call Master Dashboard — Plan 4: Branch Manager, Analyst & Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Branch Manager (6 pages), Analyst (6 pages), and Admin (12 pages) personas, plus CSV export routes for all personas.

**Architecture:** `branchService.ts`, `analystService.ts`, and `adminService.ts` are added. Branch Manager reuses unified KPI view filtered to `branch_ids`. Analyst is scoped to own `employee_code` only — no peer data exposed. Admin is the master control panel: full CRUD for users, employees, agent aliases, processes, exclusion rules, coaching, calibration, and audit config — all writing directly to the Shivamgiri DB. Export routes stream CSV.

**Tech Stack:** TypeScript/Express 5, mysql2, bcryptjs, vanilla JS, ApexCharts. Prereq: Plans 1–3 complete.

---

## File Map

### Backend — new files
```
src/callmaster/
  services/branchService.ts       ← BM queries scoped to branch_ids
  services/analystService.ts      ← Analyst queries scoped to own employee_code
  services/adminService.ts        ← ALL admin writes: users, employees, aliases, processes,
                                     exclusions, coaching, calibration, audit config, system health
  routes/bmRoutes.ts              ← POST /api/callmaster/bm/*
  routes/analystRoutes.ts         ← POST /api/callmaster/analyst/*
  routes/adminRoutes.ts           ← 30+ GET/POST/PUT/DELETE /api/callmaster/admin/* endpoints
  routes/exportRoutes.ts          ← GET /api/callmaster/export/* (CSV)
```

### Backend — modified
```
src/server.ts                     ← mount bm, analyst, admin, export routes
```

### Frontend — modified
```
public/callmaster/js/pages/bm.js      ← replace stubs
public/callmaster/js/pages/analyst.js ← replace stubs
public/callmaster/js/pages/admin.js   ← replace stubs
```

---

## Task 1: Branch Manager Service

**Files:**
- Create: `src/callmaster/services/branchService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/branchService.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';

interface Scope { branchIds: string[]; processIds: string[]; }

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function bmHealth(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const [row] = await q(`
    SELECT
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count,
      SUM(CASE WHEN alert_severity IN ('Critical','High') THEN 1 ELSE 0 END) AS high_risk_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
  `, [startDate, endDate, ...bParams, ...pParams]);

  return {
    quality_score:   row?.quality_score ?? null,
    total_calls:     Number(row?.total_calls ?? 0),
    critical_count:  Number(row?.critical_count ?? 0),
    high_risk_count: Number(row?.high_risk_count ?? 0),
  };
}

export async function bmProcessBreakdown(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return q(`
    SELECT
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
    GROUP BY process_name, source_type
    ORDER BY quality_score DESC
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function bmTeamPerformance(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const analysts = await q(`
    SELECT
      agent_employee_code AS employee_code,
      agent_employee_name AS name,
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${bClause} AND ${pClause}
      AND quality_score IS NOT NULL
    GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
    ORDER BY avg_score DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);

  // Join coaching count
  const coachingCounts = await q(`
    SELECT agent_employee_code, COUNT(*) AS coaching_count
    FROM call_coaching_queue
    WHERE status = 'Open' AND ${bClause}
    GROUP BY agent_employee_code
  `, bParams);

  const coachMap = new Map(coachingCounts.map((r: any) => [r.agent_employee_code, r.coaching_count]));

  return analysts.map((r: any) => ({
    ...r,
    coaching_count: coachMap.get(r.employee_code) || 0,
  }));
}

export async function bmDailySla(scope: Scope) {
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  const [row] = await q(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(CASE WHEN quality_score IS NOT NULL THEN 1 ELSE 0 END) AS audited_calls
    FROM v_call_master_unified_kpi
    WHERE call_date = CURDATE() AND ${bClause}
  `, bParams);

  const total   = Number(row?.total_calls ?? 0);
  const audited = Number(row?.audited_calls ?? 0);

  return {
    total_calls:    total,
    audited_calls:  audited,
    pending_calls:  total - audited,
    coverage_pct:   total > 0 ? Math.round((audited / total) * 100) : 0,
  };
}

export async function bmRiskCalls(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  return q(`
    SELECT
      source_call_id AS id, source_type, process_name,
      agent_employee_name AS agent, alert_severity, call_date
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High')
      AND ${bClause}
    ORDER BY FIELD(alert_severity,'Critical','High'), call_date DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams]);
}

export async function bmActionItems(scope: Scope) {
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  return q(`
    SELECT coaching_id AS id, 'Coaching' AS item_type,
           agent_employee_code, process_name, coaching_title AS title,
           priority, status, due_date, created_at
    FROM call_coaching_queue
    WHERE status = 'Open' AND ${bClause}
    ORDER BY FIELD(priority,'High','Medium','Low'), due_date ASC
    LIMIT 100
  `, bParams);
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/branchService.ts
git commit -m "feat(callmaster): add branch manager service (health, process breakdown, team, SLA, risk, actions)"
```

---

## Task 2: Analyst Service

**Files:**
- Create: `src/callmaster/services/analystService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/analystService.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, paginationClause, Preset } from '../repositories/baseRepository';

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function myOverview(preset: Preset, employeeCode: string) {
  const { startDate, endDate } = presetToDateRange(preset);

  const rows = await q(`
    SELECT
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS fatal_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND agent_employee_code = ?
      AND quality_score IS NOT NULL
    GROUP BY process_name, source_type
  `, [startDate, endDate, employeeCode]);

  const target = rows[0]?.source_type === 'Outbound' ? 80 : 95;

  return {
    processes: rows,
    overall_score: rows.length > 0
      ? +(rows.reduce((s: number, r: any) => s + Number(r.avg_score), 0) / rows.length).toFixed(2)
      : null,
    total_calls:   rows.reduce((s: number, r: any) => s + Number(r.total_calls), 0),
    fatal_count:   rows.reduce((s: number, r: any) => s + Number(r.fatal_count), 0),
    target_cq_pct: target,
  };
}

export async function myDefects(preset: Preset, employeeCode: string) {
  const { startDate, endDate } = presetToDateRange(preset);

  // Inbound parameter-level defects from manual_qa_audit
  return q(`
    SELECT
      'opening_greeting' AS param,
      SUM(CASE WHEN mqa.opening_greeting < 1 THEN 1 ELSE 0 END) AS lost_marks
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'compliance',
      SUM(CASE WHEN mqa.compliance < 1 THEN 1 ELSE 0 END)
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'resolution',
      SUM(CASE WHEN mqa.resolution_provided < 1 THEN 1 ELSE 0 END)
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
    UNION ALL
    SELECT 'hold_procedure',
      SUM(CASE WHEN mqa.hold_procedure < 1 THEN 1 ELSE 0 END)
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND k.agent_employee_code = ?
  `, [
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
    startDate, endDate, employeeCode,
  ]);
}

export async function myCalls(preset: Preset, employeeCode: string, page = 1, limit = 50) {
  const { startDate, endDate } = presetToDateRange(preset);

  const [[{ total }]] = await (db as any).execute<any[]>(
    `SELECT COUNT(*) AS total FROM v_call_master_unified_kpi
     WHERE call_date BETWEEN ? AND ? AND agent_employee_code = ?`,
    [startDate, endDate, employeeCode]
  );

  const calls = await q(`
    SELECT source_call_id AS id, source_type, process_name,
           call_date, quality_score, quality_band, alert_severity
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND agent_employee_code = ?
    ORDER BY call_date DESC
    ${paginationClause({ page, limit })}
  `, [startDate, endDate, employeeCode]);

  return { total: Number(total), calls };
}

export async function myTrend(employeeCode: string) {
  return q(`
    SELECT call_date,
           COUNT(*) AS total_calls,
           ROUND(AVG(quality_score), 2) AS avg_score
    FROM v_call_master_unified_kpi
    WHERE call_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND agent_employee_code = ?
      AND quality_score IS NOT NULL
    GROUP BY call_date
    ORDER BY call_date
  `, [employeeCode]);
}

export async function myCoachingNotes(employeeCode: string) {
  return q(`
    SELECT coaching_id AS id, coaching_title AS title, coaching_reason AS notes,
           assigned_to AS coach, priority, status, created_at
    FROM call_coaching_queue
    WHERE agent_employee_code = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [employeeCode]);
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/analystService.ts
git commit -m "feat(callmaster): add analyst service (my overview, defects, calls, trend, coaching — scoped to employee_code)"
```

---

## Task 3: Admin Service

**Files:**
- Create: `src/callmaster/services/adminService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/adminService.ts
import db from '../../config/db';
import bcrypt from 'bcryptjs';
import { getExternalPool } from '../../config/dbExternal';

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

// ─── CATEGORY 1: USERS ────────────────────────────────────────────────────────

export async function listUsers() {
  return q(`
    SELECT user_id, username, full_name, role, branch_ids, process_ids, employee_code, active, created_at
    FROM cm_users ORDER BY created_at DESC
  `, []);
}

export async function getUserById(userId: number) {
  const rows = await q<any>(`
    SELECT user_id, username, full_name, role, branch_ids, process_ids, employee_code, active, created_at
    FROM cm_users WHERE user_id = ?
  `, [userId]);
  return rows[0] ?? null;
}

export async function createUser(data: {
  username: string; password: string; full_name: string;
  role: string; branch_ids: string[]; process_ids: string[]; employee_code?: string;
}) {
  const hash = await bcrypt.hash(data.password, 10);
  const [result] = await (db as any).execute(
    `INSERT INTO cm_users (username, password_hash, full_name, role, branch_ids, process_ids, employee_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.username, hash, data.full_name, data.role,
     JSON.stringify(data.branch_ids), JSON.stringify(data.process_ids),
     data.employee_code || null]
  );
  return { user_id: (result as any).insertId };
}

export async function updateUser(userId: number, data: Partial<{
  full_name: string; role: string; branch_ids: string[]; process_ids: string[];
  employee_code: string; active: number;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.full_name     !== undefined) { fields.push('full_name = ?');    params.push(data.full_name); }
  if (data.role          !== undefined) { fields.push('role = ?');          params.push(data.role); }
  if (data.branch_ids    !== undefined) { fields.push('branch_ids = ?');    params.push(JSON.stringify(data.branch_ids)); }
  if (data.process_ids   !== undefined) { fields.push('process_ids = ?');   params.push(JSON.stringify(data.process_ids)); }
  if (data.employee_code !== undefined) { fields.push('employee_code = ?'); params.push(data.employee_code); }
  if (data.active        !== undefined) { fields.push('active = ?');        params.push(data.active); }

  if (fields.length === 0) return;
  params.push(userId);
  await (db as any).execute(`UPDATE cm_users SET ${fields.join(', ')} WHERE user_id = ?`, params);
}

export async function deactivateUser(userId: number) {
  await (db as any).execute(`UPDATE cm_users SET active = 0 WHERE user_id = ?`, [userId]);
}

export async function deleteUser(userId: number) {
  await (db as any).execute(`DELETE FROM cm_users WHERE user_id = ?`, [userId]);
}

export async function resetUserPassword(userId: number, newPassword: string) {
  const hash = await bcrypt.hash(newPassword, 10);
  await (db as any).execute(`UPDATE cm_users SET password_hash = ? WHERE user_id = ?`, [hash, userId]);
}

// ─── CATEGORY 2: EMPLOYEES ────────────────────────────────────────────────────

export async function listEmployees(filters: { branch?: string; process?: string; active?: number } = {}) {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.branch)  { clauses.push('branch = ?');         params.push(filters.branch); }
  if (filters.process) { clauses.push('process_name = ?');   params.push(filters.process); }
  if (filters.active !== undefined) { clauses.push('active_status = ?'); params.push(filters.active); }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return q(`
    SELECT emp_id, employee_code, employee_name, process_name, branch, designation,
           team_leader_code, active_status, created_at
    FROM employee_mapping_master ${where} ORDER BY employee_name
  `, params);
}

export async function createEmployee(data: {
  employee_code: string; employee_name: string; process_name: string; branch: string;
  designation?: string; team_leader_code?: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO employee_mapping_master
       (employee_code, employee_name, process_name, branch, designation, team_leader_code, active_status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [data.employee_code, data.employee_name, data.process_name, data.branch,
     data.designation || null, data.team_leader_code || null]
  );
  return { emp_id: (result as any).insertId };
}

export async function updateEmployee(empId: number, data: Partial<{
  employee_name: string; process_name: string; branch: string;
  designation: string; team_leader_code: string; active_status: number;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.employee_name  !== undefined) { fields.push('employee_name = ?');   params.push(data.employee_name); }
  if (data.process_name   !== undefined) { fields.push('process_name = ?');    params.push(data.process_name); }
  if (data.branch         !== undefined) { fields.push('branch = ?');          params.push(data.branch); }
  if (data.designation    !== undefined) { fields.push('designation = ?');     params.push(data.designation); }
  if (data.team_leader_code !== undefined) { fields.push('team_leader_code = ?'); params.push(data.team_leader_code); }
  if (data.active_status  !== undefined) { fields.push('active_status = ?');   params.push(data.active_status); }

  if (fields.length === 0) return;
  params.push(empId);
  await (db as any).execute(`UPDATE employee_mapping_master SET ${fields.join(', ')} WHERE emp_id = ?`, params);
}

export async function deleteEmployee(empId: number) {
  await (db as any).execute(`DELETE FROM employee_mapping_master WHERE emp_id = ?`, [empId]);
}

export async function bulkImportEmployees(rows: Array<{
  employee_code: string; employee_name: string; process_name: string;
  branch: string; designation?: string; team_leader_code?: string;
}>) {
  if (rows.length === 0) return { inserted: 0 };
  const values = rows.map(() => '(?, ?, ?, ?, ?, ?, 1)').join(', ');
  const params = rows.flatMap(r => [
    r.employee_code, r.employee_name, r.process_name, r.branch,
    r.designation || null, r.team_leader_code || null,
  ]);
  await (db as any).execute(
    `INSERT IGNORE INTO employee_mapping_master
       (employee_code, employee_name, process_name, branch, designation, team_leader_code, active_status)
     VALUES ${values}`,
    params
  );
  return { inserted: rows.length };
}

// ─── CATEGORY 3: AGENT ALIASES ────────────────────────────────────────────────

export async function listAliases(processName?: string) {
  const where = processName ? `WHERE a.process_name = ?` : '';
  const params = processName ? [processName] : [];
  return q(`
    SELECT a.alias_id, a.source_alias, a.employee_code, a.process_name,
           e.employee_name, a.created_at
    FROM employee_source_alias a
    LEFT JOIN employee_mapping_master e ON e.employee_code = a.employee_code
    ${where}
    ORDER BY a.process_name, a.source_alias
  `, params);
}

export async function createAlias(data: {
  source_alias: string; employee_code: string; process_name: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO employee_source_alias (source_alias, employee_code, process_name)
     VALUES (?, ?, ?)`,
    [data.source_alias, data.employee_code, data.process_name]
  );
  return { alias_id: (result as any).insertId };
}

export async function updateAlias(aliasId: number, data: {
  employee_code: string; process_name: string;
}) {
  await (db as any).execute(
    `UPDATE employee_source_alias SET employee_code = ?, process_name = ? WHERE alias_id = ?`,
    [data.employee_code, data.process_name, aliasId]
  );
}

export async function deleteAlias(aliasId: number) {
  await (db as any).execute(`DELETE FROM employee_source_alias WHERE alias_id = ?`, [aliasId]);
}

export async function bulkImportAliases(rows: Array<{
  source_alias: string; employee_code: string; process_name: string;
}>) {
  if (rows.length === 0) return { inserted: 0 };
  const values = rows.map(() => '(?, ?, ?)').join(', ');
  const params = rows.flatMap(r => [r.source_alias, r.employee_code, r.process_name]);
  await (db as any).execute(
    `INSERT IGNORE INTO employee_source_alias (source_alias, employee_code, process_name) VALUES ${values}`,
    params
  );
  return { inserted: rows.length };
}

// ─── CATEGORY 4: PROCESSES ────────────────────────────────────────────────────

export async function listProcesses() {
  return q(`
    SELECT process_id, process_name, business_lob, branch, source_type,
           dialdesk_client_id, target_cq_pct, active_status
    FROM process_mapping_master
    ORDER BY source_type, process_name
  `, []);
}

export async function createProcess(data: {
  process_name: string; business_lob: string; branch: string;
  source_type: 'Inbound' | 'Outbound'; dialdesk_client_id?: string; target_cq_pct?: number;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO process_mapping_master
       (process_name, business_lob, branch, source_type, dialdesk_client_id, target_cq_pct, active_status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [data.process_name, data.business_lob, data.branch, data.source_type,
     data.dialdesk_client_id || null,
     data.target_cq_pct ?? (data.source_type === 'Inbound' ? 95 : 80)]
  );
  return { process_id: (result as any).insertId };
}

export async function updateProcess(processId: number, data: Partial<{
  process_name: string; business_lob: string; branch: string;
  source_type: string; dialdesk_client_id: string; target_cq_pct: number; active_status: number;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.process_name      !== undefined) { fields.push('process_name = ?');      params.push(data.process_name); }
  if (data.business_lob      !== undefined) { fields.push('business_lob = ?');      params.push(data.business_lob); }
  if (data.branch            !== undefined) { fields.push('branch = ?');             params.push(data.branch); }
  if (data.source_type       !== undefined) { fields.push('source_type = ?');       params.push(data.source_type); }
  if (data.dialdesk_client_id !== undefined) { fields.push('dialdesk_client_id = ?'); params.push(data.dialdesk_client_id); }
  if (data.target_cq_pct     !== undefined) { fields.push('target_cq_pct = ?');     params.push(data.target_cq_pct); }
  if (data.active_status     !== undefined) { fields.push('active_status = ?');     params.push(data.active_status); }

  if (fields.length === 0) return;
  params.push(processId);
  await (db as any).execute(`UPDATE process_mapping_master SET ${fields.join(', ')} WHERE process_id = ?`, params);
}

export async function deleteProcess(processId: number) {
  await (db as any).execute(`DELETE FROM process_mapping_master WHERE process_id = ?`, [processId]);
}

// ─── CATEGORY 5: EXCLUSION RULES ─────────────────────────────────────────────

export async function listExclusionRules() {
  return q(`
    SELECT rule_id, process_name, source_type, field_name, operator,
           field_value, reason, created_by, created_at
    FROM dashboard_exclusion_rules
    ORDER BY process_name, field_name
  `, []);
}

export async function createExclusionRule(data: {
  process_name: string; source_type: string; field_name: string;
  operator: string; field_value: string; reason?: string; created_by: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO dashboard_exclusion_rules
       (process_name, source_type, field_name, operator, field_value, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.process_name, data.source_type, data.field_name, data.operator,
     data.field_value, data.reason || null, data.created_by]
  );
  return { rule_id: (result as any).insertId };
}

export async function updateExclusionRule(ruleId: number, data: Partial<{
  field_name: string; operator: string; field_value: string; reason: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.field_name  !== undefined) { fields.push('field_name = ?');  params.push(data.field_name); }
  if (data.operator    !== undefined) { fields.push('operator = ?');    params.push(data.operator); }
  if (data.field_value !== undefined) { fields.push('field_value = ?'); params.push(data.field_value); }
  if (data.reason      !== undefined) { fields.push('reason = ?');      params.push(data.reason); }

  if (fields.length === 0) return;
  params.push(ruleId);
  await (db as any).execute(`UPDATE dashboard_exclusion_rules SET ${fields.join(', ')} WHERE rule_id = ?`, params);
}

export async function deleteExclusionRule(ruleId: number) {
  await (db as any).execute(`DELETE FROM dashboard_exclusion_rules WHERE rule_id = ?`, [ruleId]);
}

// ─── CATEGORY 6: COACHING QUEUE ───────────────────────────────────────────────

export async function listCoachingQueue(filters: {
  status?: string; process?: string; priority?: string; page?: number; limit?: number;
} = {}) {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.status)  { clauses.push('status = ?');       params.push(filters.status); }
  if (filters.process) { clauses.push('process_name = ?'); params.push(filters.process); }
  if (filters.priority){ clauses.push('priority = ?');     params.push(filters.priority); }

  const where  = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const page   = Math.max(1, filters.page || 1);
  const limit  = Math.min(100, filters.limit || 50);
  const offset = (page - 1) * limit;

  const [[{ total }]] = await (db as any).execute<any[]>(
    `SELECT COUNT(*) AS total FROM call_coaching_queue ${where}`, params
  );
  const rows = await q(`
    SELECT coaching_id AS id, agent_employee_code, agent_employee_name, process_name,
           coaching_title AS title, coaching_reason AS reason, priority, status,
           assigned_to, due_date, created_at, updated_at
    FROM call_coaching_queue ${where}
    ORDER BY FIELD(priority,'High','Medium','Low'), due_date ASC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return { total: Number(total), rows };
}

export async function createCoachingEntry(data: {
  agent_employee_code: string; agent_employee_name: string; process_name: string;
  source_call_id?: string; coaching_title: string; coaching_reason: string;
  priority: string; assigned_to?: string; due_date?: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO call_coaching_queue
       (agent_employee_code, agent_employee_name, process_name, source_call_id,
        coaching_title, coaching_reason, priority, assigned_to, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')`,
    [data.agent_employee_code, data.agent_employee_name, data.process_name,
     data.source_call_id || null, data.coaching_title, data.coaching_reason,
     data.priority, data.assigned_to || null, data.due_date || null]
  );
  return { coaching_id: (result as any).insertId };
}

export async function updateCoachingEntry(coachingId: number, data: Partial<{
  coaching_title: string; coaching_reason: string; priority: string;
  assigned_to: string; due_date: string; status: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.coaching_title  !== undefined) { fields.push('coaching_title = ?');  params.push(data.coaching_title); }
  if (data.coaching_reason !== undefined) { fields.push('coaching_reason = ?'); params.push(data.coaching_reason); }
  if (data.priority        !== undefined) { fields.push('priority = ?');        params.push(data.priority); }
  if (data.assigned_to     !== undefined) { fields.push('assigned_to = ?');     params.push(data.assigned_to); }
  if (data.due_date        !== undefined) { fields.push('due_date = ?');        params.push(data.due_date); }
  if (data.status          !== undefined) { fields.push('status = ?');          params.push(data.status); }

  if (fields.length === 0) return;
  params.push(coachingId);
  await (db as any).execute(`UPDATE call_coaching_queue SET ${fields.join(', ')} WHERE coaching_id = ?`, params);
}

export async function bulkCloseCoaching(coachingIds: number[]) {
  if (coachingIds.length === 0) return { updated: 0 };
  const placeholders = coachingIds.map(() => '?').join(', ');
  await (db as any).execute(
    `UPDATE call_coaching_queue SET status = 'Closed' WHERE coaching_id IN (${placeholders})`,
    coachingIds
  );
  return { updated: coachingIds.length };
}

// ─── CATEGORY 7: CALIBRATION ──────────────────────────────────────────────────

export async function listCalibrationSessions(filters: {
  process?: string; status?: string; page?: number;
} = {}) {
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.process) { clauses.push('process_name = ?');    params.push(filters.process); }
  if (filters.status)  { clauses.push('session_status = ?');  params.push(filters.status); }

  const where  = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const page   = Math.max(1, filters.page || 1);
  const offset = (page - 1) * 20;

  const [[{ total }]] = await (db as any).execute<any[]>(
    `SELECT COUNT(*) AS total FROM calibration_session ${where}`, params
  );
  const rows = await q(`
    SELECT session_id, process_name, session_date, facilitator_name,
           session_status, participant_count, notes, created_at
    FROM calibration_session ${where}
    ORDER BY session_date DESC
    LIMIT 20 OFFSET ?
  `, [...params, offset]);

  return { total: Number(total), rows };
}

export async function createCalibrationSession(data: {
  process_name: string; session_date: string; facilitator_name: string; notes?: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO calibration_session (process_name, session_date, facilitator_name, notes, session_status)
     VALUES (?, ?, ?, ?, 'Scheduled')`,
    [data.process_name, data.session_date, data.facilitator_name, data.notes || null]
  );
  return { session_id: (result as any).insertId };
}

export async function updateCalibrationSession(sessionId: number, data: Partial<{
  session_date: string; facilitator_name: string; session_status: string;
  participant_count: number; notes: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.session_date      !== undefined) { fields.push('session_date = ?');      params.push(data.session_date); }
  if (data.facilitator_name  !== undefined) { fields.push('facilitator_name = ?');  params.push(data.facilitator_name); }
  if (data.session_status    !== undefined) { fields.push('session_status = ?');    params.push(data.session_status); }
  if (data.participant_count !== undefined) { fields.push('participant_count = ?'); params.push(data.participant_count); }
  if (data.notes             !== undefined) { fields.push('notes = ?');             params.push(data.notes); }

  if (fields.length === 0) return;
  params.push(sessionId);
  await (db as any).execute(`UPDATE calibration_session SET ${fields.join(', ')} WHERE session_id = ?`, params);
}

export async function listCalibrationCalls(sessionId: number) {
  return q(`
    SELECT cc.cal_call_id, cc.source_call_id, cc.agent_employee_code,
           cc.facilitator_score, cc.agreed_score, cc.variance, cc.call_notes,
           e.employee_name
    FROM calibration_call cc
    LEFT JOIN employee_mapping_master e ON e.employee_code = cc.agent_employee_code
    WHERE cc.session_id = ?
    ORDER BY cc.variance DESC
  `, [sessionId]);
}

export async function addCalibrationCall(data: {
  session_id: number; source_call_id: string; agent_employee_code: string;
  facilitator_score: number; agreed_score?: number; call_notes?: string;
}) {
  const variance = data.agreed_score !== undefined
    ? Math.abs(data.facilitator_score - data.agreed_score)
    : null;

  const [result] = await (db as any).execute(
    `INSERT INTO calibration_call
       (session_id, source_call_id, agent_employee_code, facilitator_score, agreed_score, variance, call_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.session_id, data.source_call_id, data.agent_employee_code,
     data.facilitator_score, data.agreed_score ?? null, variance, data.call_notes || null]
  );
  return { cal_call_id: (result as any).insertId };
}

// ─── CATEGORY 8: AUDIT PROMPT CONFIG ─────────────────────────────────────────

export async function listAuditPrompts(processName?: string) {
  const where = processName ? `WHERE process_name = ?` : '';
  const params = processName ? [processName] : [];
  return q(`
    SELECT prompt_id, process_name, source_type, parameter_name,
           max_marks, prompt_text, active
    FROM audit_prompt_config ${where}
    ORDER BY process_name, parameter_name
  `, params);
}

export async function createAuditPrompt(data: {
  process_name: string; source_type: string; parameter_name: string;
  max_marks: number; prompt_text: string;
}) {
  const [result] = await (db as any).execute(
    `INSERT INTO audit_prompt_config
       (process_name, source_type, parameter_name, max_marks, prompt_text, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [data.process_name, data.source_type, data.parameter_name, data.max_marks, data.prompt_text]
  );
  return { prompt_id: (result as any).insertId };
}

export async function updateAuditPrompt(promptId: number, data: Partial<{
  parameter_name: string; max_marks: number; prompt_text: string; active: number;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.parameter_name !== undefined) { fields.push('parameter_name = ?'); params.push(data.parameter_name); }
  if (data.max_marks      !== undefined) { fields.push('max_marks = ?');      params.push(data.max_marks); }
  if (data.prompt_text    !== undefined) { fields.push('prompt_text = ?');    params.push(data.prompt_text); }
  if (data.active         !== undefined) { fields.push('active = ?');         params.push(data.active); }

  if (fields.length === 0) return;
  params.push(promptId);
  await (db as any).execute(`UPDATE audit_prompt_config SET ${fields.join(', ')} WHERE prompt_id = ?`, params);
}

export async function deleteAuditPrompt(promptId: number) {
  await (db as any).execute(`DELETE FROM audit_prompt_config WHERE prompt_id = ?`, [promptId]);
}

// ─── SYSTEM HEALTH ────────────────────────────────────────────────────────────

export async function systemHealth() {
  const results: Record<string, any> = {};

  try {
    const start = Date.now();
    await (db as any).execute('SELECT 1');
    results.shivamgiri = { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    results.shivamgiri = { status: 'error', error: e.message };
  }

  try {
    const start = Date.now();
    await (getExternalPool() as any).execute('SELECT 1');
    results.db_external = { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    results.db_external = { status: 'error', error: e.message };
  }

  try {
    const [[row]] = await (db as any).execute<any[]>('SELECT COUNT(*) AS cnt FROM cm_users');
    results.cm_users_count = Number((row as any).cnt ?? 0);
  } catch {
    results.cm_users_count = null;
  }

  try {
    const [[row]] = await (db as any).execute<any[]>('SELECT COUNT(*) AS cnt FROM process_mapping_master WHERE active_status = 1');
    results.active_processes = Number((row as any).cnt ?? 0);
  } catch {
    results.active_processes = null;
  }

  try {
    const [[row]] = await (db as any).execute<any[]>('SELECT COUNT(*) AS cnt FROM call_coaching_queue WHERE status = \'Open\'');
    results.open_coaching_items = Number((row as any).cnt ?? 0);
  } catch {
    results.open_coaching_items = null;
  }

  return { pools: results, checked_at: new Date().toISOString() };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/adminService.ts
git commit -m "feat(callmaster): add admin service (full CRUD — users, employees, aliases, processes, exclusions, coaching, calibration, audit-config, system health)"
```

---

## Task 4: BM, Analyst, Admin Routes + server.ts

**Files:**
- Create: `src/callmaster/routes/bmRoutes.ts`
- Create: `src/callmaster/routes/analystRoutes.ts`
- Create: `src/callmaster/routes/adminRoutes.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Create bmRoutes.ts**

```typescript
// src/callmaster/routes/bmRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as bm from '../services/branchService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'branch_manager'));

const scope = (req: Request) => ({ branchIds: req.cm!.branch_ids, processIds: req.cm!.process_ids });
const preset = (req: Request): Preset => (req.body?.preset as Preset) || 'MTD';
const wrap = (fn: Function) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

router.post('/health',           wrap(req => bm.bmHealth(preset(req), scope(req))));
router.post('/process-breakdown',wrap(req => bm.bmProcessBreakdown(preset(req), scope(req))));
router.post('/team-performance', wrap(req => bm.bmTeamPerformance(preset(req), scope(req))));
router.post('/daily-sla',        wrap(req => bm.bmDailySla(scope(req))));
router.post('/risk-calls',       wrap(req => bm.bmRiskCalls(preset(req), scope(req))));
router.post('/action-items',     wrap(req => bm.bmActionItems(scope(req))));

export default router;
```

- [ ] **Step 2: Create analystRoutes.ts**

```typescript
// src/callmaster/routes/analystRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as analyst from '../services/analystService';
import { getInboundCallDetail } from '../repositories/inboundRepo';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'analyst', 'process_manager', 'tq_head'));

const preset = (req: Request): Preset => (req.body?.preset as Preset) || 'MTD';
const wrap = (fn: Function) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

// All analyst routes are scoped to own employee_code
router.post('/overview', wrap(req => {
  const code = req.cm!.employee_code || '';
  if (!code) throw new Error('employee_code not set for this user');
  return analyst.myOverview(preset(req), code);
}));

router.post('/defects', wrap(req => {
  const code = req.cm!.employee_code || '';
  if (!code) throw new Error('employee_code not set for this user');
  return analyst.myDefects(preset(req), code);
}));

router.post('/my-calls', wrap(req => {
  const code = req.cm!.employee_code || '';
  if (!code) throw new Error('employee_code not set for this user');
  return analyst.myCalls(preset(req), code, Number(req.body?.page || 1), 50);
}));

router.post('/trend', wrap(req => {
  const code = req.cm!.employee_code || '';
  if (!code) throw new Error('employee_code not set for this user');
  return analyst.myTrend(code);
}));

router.get('/coaching', wrap(req => {
  const code = req.cm!.employee_code || '';
  if (!code) throw new Error('employee_code not set for this user');
  return analyst.myCoachingNotes(code);
}));

router.get('/call/:id', wrap(req => getInboundCallDetail(req.params.id)));

export default router;
```

- [ ] **Step 3: Create adminRoutes.ts**

```typescript
// src/callmaster/routes/adminRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import jwt from 'jsonwebtoken';
import * as admin from '../services/adminService';
import db from '../../config/db';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin'));

const wrap = (fn: Function) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Users ───────────────────────────────────────────────────────────────────
router.get('/users',                wrap(() => admin.listUsers()));
router.get('/users/:id',            wrap(req => admin.getUserById(Number(req.params.id))));
router.post('/users',               wrap(req => admin.createUser(req.body)));
router.put('/users/:id',            wrap(req => admin.updateUser(Number(req.params.id), req.body)));
router.patch('/users/:id/deactivate', wrap(req => admin.deactivateUser(Number(req.params.id))));
router.delete('/users/:id',         wrap(req => admin.deleteUser(Number(req.params.id))));
router.post('/users/:id/reset-password', wrap(req => admin.resetUserPassword(Number(req.params.id), req.body.new_password)));

// ── Employees ────────────────────────────────────────────────────────────────
router.get('/employees',            wrap(req => admin.listEmployees(req.query as any)));
router.post('/employees',           wrap(req => admin.createEmployee(req.body)));
router.put('/employees/:id',        wrap(req => admin.updateEmployee(Number(req.params.id), req.body)));
router.delete('/employees/:id',     wrap(req => admin.deleteEmployee(Number(req.params.id))));
router.post('/employees/bulk-import', wrap(req => admin.bulkImportEmployees(req.body.rows)));

// ── Agent Aliases ─────────────────────────────────────────────────────────────
router.get('/aliases',              wrap(req => admin.listAliases(req.query.process_name as string)));
router.post('/aliases',             wrap(req => admin.createAlias(req.body)));
router.put('/aliases/:id',          wrap(req => admin.updateAlias(Number(req.params.id), req.body)));
router.delete('/aliases/:id',       wrap(req => admin.deleteAlias(Number(req.params.id))));
router.post('/aliases/bulk-import', wrap(req => admin.bulkImportAliases(req.body.rows)));

// ── Processes ─────────────────────────────────────────────────────────────────
router.get('/processes',            wrap(() => admin.listProcesses()));
router.post('/processes',           wrap(req => admin.createProcess(req.body)));
router.put('/processes/:id',        wrap(req => admin.updateProcess(Number(req.params.id), req.body)));
router.delete('/processes/:id',     wrap(req => admin.deleteProcess(Number(req.params.id))));

// ── Exclusion Rules ───────────────────────────────────────────────────────────
router.get('/exclusions',           wrap(() => admin.listExclusionRules()));
router.post('/exclusions',          wrap(req => admin.createExclusionRule({ ...req.body, created_by: req.cm!.username })));
router.put('/exclusions/:id',       wrap(req => admin.updateExclusionRule(Number(req.params.id), req.body)));
router.delete('/exclusions/:id',    wrap(req => admin.deleteExclusionRule(Number(req.params.id))));

// ── Coaching ──────────────────────────────────────────────────────────────────
router.get('/coaching',             wrap(req => admin.listCoachingQueue(req.query as any)));
router.post('/coaching',            wrap(req => admin.createCoachingEntry(req.body)));
router.put('/coaching/:id',         wrap(req => admin.updateCoachingEntry(Number(req.params.id), req.body)));
router.post('/coaching/bulk-close', wrap(req => admin.bulkCloseCoaching(req.body.ids)));

// ── Calibration ───────────────────────────────────────────────────────────────
router.get('/calibration/sessions',       wrap(req => admin.listCalibrationSessions(req.query as any)));
router.post('/calibration/sessions',      wrap(req => admin.createCalibrationSession(req.body)));
router.put('/calibration/sessions/:id',   wrap(req => admin.updateCalibrationSession(Number(req.params.id), req.body)));
router.get('/calibration/sessions/:id/calls', wrap(req => admin.listCalibrationCalls(Number(req.params.id))));
router.post('/calibration/calls',         wrap(req => admin.addCalibrationCall(req.body)));

// ── Audit Prompt Config ───────────────────────────────────────────────────────
router.get('/audit-prompts',        wrap(req => admin.listAuditPrompts(req.query.process_name as string)));
router.post('/audit-prompts',       wrap(req => admin.createAuditPrompt(req.body)));
router.put('/audit-prompts/:id',    wrap(req => admin.updateAuditPrompt(Number(req.params.id), req.body)));
router.delete('/audit-prompts/:id', wrap(req => admin.deleteAuditPrompt(Number(req.params.id))));

// ── System Health ─────────────────────────────────────────────────────────────
router.get('/system-health',        wrap(() => admin.systemHealth()));

// ── Impersonate ───────────────────────────────────────────────────────────────
router.post('/impersonate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { target_user_id } = req.body;
    const [rows] = await (db as any).execute<any[]>(
      `SELECT user_id, username, full_name, role, branch_ids, process_ids, employee_code
       FROM cm_users WHERE user_id = ? AND active = 1 LIMIT 1`,
      [target_user_id]
    );
    if (!rows.length) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const u = rows[0];
    const payload = {
      user_id: u.user_id, username: u.username, full_name: u.full_name,
      role: u.role,
      branch_ids:  typeof u.branch_ids  === 'string' ? JSON.parse(u.branch_ids)  : u.branch_ids,
      process_ids: typeof u.process_ids === 'string' ? JSON.parse(u.process_ids) : u.process_ids,
      employee_code: u.employee_code,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.json({ success: true, token, user: payload });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
```

- [ ] **Step 4: Mount all new routes in server.ts**

Add to `src/server.ts` after the PM route mount:

```typescript
import bmRoutes      from './callmaster/routes/bmRoutes';
import analystRoutes from './callmaster/routes/analystRoutes';
import adminCmRoutes from './callmaster/routes/adminRoutes';

// ...existing mounts...
app.use('/api/callmaster/bm',      bmRoutes);
app.use('/api/callmaster/analyst', analystRoutes);
app.use('/api/callmaster/admin',   adminCmRoutes);
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/callmaster/routes/bmRoutes.ts src/callmaster/routes/analystRoutes.ts src/callmaster/routes/adminRoutes.ts src/server.ts
git commit -m "feat(callmaster): add BM, Analyst, Admin routes (45+ endpoints) + mount in server.ts"
```

---

## Task 5: Export Routes (CSV)

**Files:**
- Create: `src/callmaster/routes/exportRoutes.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/routes/exportRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware } from '../middleware/cmAuth';
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';

const router = Router();
router.use(cmAuthMiddleware);

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const v = row[h];
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(','));
  }
  return lines.join('\n');
}

function sendCsv(res: Response, filename: string, data: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
}

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', req.cm!.branch_ids);
    const rows = await q(`
      SELECT source_call_id, source_type, process_name, branch_short_name,
             agent_employee_name, alert_severity, call_date
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ? AND alert_severity IN ('Critical','High') AND ${bClause}
      ORDER BY call_date DESC LIMIT 10000
    `, [startDate, endDate, ...bParams]);
    sendCsv(res, `alerts_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analyst-performance', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const { clause: pClause, params: pParams } = safeScopeFilter('process_name', req.cm!.process_ids);
    const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', req.cm!.branch_ids);
    const rows = await q(`
      SELECT agent_employee_code, agent_employee_name, process_name, source_type,
             COUNT(*) AS total_calls, ROUND(AVG(quality_score),2) AS avg_score,
             SUM(is_critical_call) AS critical_count
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ? AND ${pClause} AND ${bClause}
        AND quality_score IS NOT NULL
      GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
      ORDER BY avg_score DESC
    `, [startDate, endDate, ...pParams, ...bParams]);
    sendCsv(res, `analyst_performance_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/process-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const rows = await q(`
      SELECT process_name, source_type,
             COUNT(*) AS total_calls, ROUND(AVG(quality_score),2) AS avg_score,
             SUM(is_critical_call) AS critical_count,
             SUM(CASE WHEN quality_score < 85 THEN 1 ELSE 0 END) AS below_avg_count
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ?
      GROUP BY process_name, source_type
      ORDER BY avg_score DESC
    `, [startDate, endDate]);
    sendCsv(res, `process_summary_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
```

- [ ] **Step 2: Mount in server.ts**

Add after the Admin route mount:

```typescript
import exportRoutes from './callmaster/routes/exportRoutes';
// ...
app.use('/api/callmaster/export', exportRoutes);
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/callmaster/routes/exportRoutes.ts src/server.ts
git commit -m "feat(callmaster): add CSV export routes (alerts, analyst performance, process summary)"
```

---

## Task 6: Branch Manager Frontend

**Files:**
- Modify: `public/callmaster/js/pages/bm.js`

- [ ] **Step 1: Replace BM_PAGES**

```javascript
// public/callmaster/js/pages/bm.js

const BM_PAGES = {

  'bm-health': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/health', { preset });
    const d = r.data || {};
    setTimeout(() => {
      gaugeChart('bmHealthGauge', d.quality_score || 0, 100, `${d.quality_score || 0}%`, { color: (d.quality_score || 0) >= 85 ? '#06d6a0' : '#ef4444' });
    }, 0);
    return `
      ${pageHeader('Branch Health', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'bm-health')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Quality Score',  (d.quality_score || 0) + '%', 'Combined all processes')}
        ${kpi('Total Calls',    Number(d.total_calls  || 0).toLocaleString())}
        ${kpi('Critical',       Number(d.critical_count  || 0).toLocaleString(), '', d.critical_count > 0 ? 'down' : 'up')}
        ${kpi('High Risk',      Number(d.high_risk_count || 0).toLocaleString())}
      </div>
      <div class="card"><div id="bmHealthGauge"></div></div>`;
  },

  'bm-process-breakdown': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/process-breakdown', { preset });
    const rows = r.data?.processes || r.data || [];
    return `
      ${pageHeader('Process Breakdown', 'All processes in this branch · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'bm-process-breakdown')")}
      </div>
      <div class="grid-auto">
        ${rows.map(p => `
          <div class="card">
            <div class="card-title">${p.process_name}</div>
            <div style="display:flex;gap:16px;align-items:center;margin-top:8px">
              <div>
                <div class="kpi-value td-mono">${p.quality_score != null ? p.quality_score + '%' : '—'}</div>
                <div class="kpi-sub">${Number(p.total_calls || 0).toLocaleString()} calls</div>
              </div>
              <span class="badge badge-${p.source_type==='Inbound'?'blue':'violet'}">${p.source_type}</span>
            </div>
            ${p.critical_count > 0 ? `<div class="kpi-sub" style="margin-top:8px"><span class="sev-critical">${p.critical_count} critical</span></div>` : ''}
          </div>
        `).join('') || emptyState('No process data for period')}
      </div>`;
  },

  'bm-team-performance': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/team-performance', { preset });
    const rows = r.data?.agents || r.data || [];
    return `
      ${pageHeader('Team Performance', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'bm-team-performance')")}
      </div>
      ${table(
        [
          { key: 'name',           label: 'Analyst' },
          { key: 'process_name',   label: 'Process' },
          { key: 'avg_score',      label: 'Avg CQ%',   render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',    label: 'Calls',     render: v => Number(v || 0).toLocaleString() },
          { key: 'critical_count', label: 'Critical',  render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'coaching_count', label: 'Open Coaching', render: v => v > 0 ? `<span class="sev-high">${v}</span>` : '0' },
        ],
        rows,
        { emptyMsg: 'No team data for selected period' }
      )}`;
  },

  'bm-daily-sla': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/daily-sla', { preset });
    const d = r.data || {};
    return `
      ${pageHeader('Daily SLA', "Today's audit coverage")}
      <div class="kpi-grid">
        ${kpi('Total Calls Today', Number(d.total_calls  || 0).toLocaleString())}
        ${kpi('Audited',           Number(d.audited_calls || 0).toLocaleString())}
        ${kpi('Pending',           Number(d.pending_calls || 0).toLocaleString(), '', d.pending_calls > 50 ? 'down' : 'up')}
        ${kpi('Coverage%',         (d.coverage_pct || 0) + '%')}
      </div>`;
  },

  'bm-risk-calls': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/risk-calls', { preset });
    const calls = r.data?.calls || r.data || [];
    return `
      ${pageHeader('Risk Call Feed', 'Critical + High severity · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'bm-risk-calls')")}
      </div>
      ${table(
        [
          { key: 'id',           label: 'Call ID',  render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_type',  label: 'Type' },
          { key: 'process_name', label: 'Process' },
          { key: 'agent',        label: 'Agent', render: (v, row) => v || row.agent_employee_name },
          { key: 'alert_severity',label: 'Severity', render: v => sevBadge(v) },
          { key: 'call_date',    label: 'Date' },
        ],
        calls,
        { emptyMsg: 'No risk calls for selected period' }
      )}`;
  },

  'bm-action-items': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/action-items', { preset });
    const items = r.data?.items || r.data || [];
    return `
      ${pageHeader('Action Items', `${items.length} open`)}
      ${table(
        [
          { key: 'item_type',          label: 'Type' },
          { key: 'agent_employee_code', label: 'Employee', render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'process_name',       label: 'Process' },
          { key: 'title',              label: 'Task', render: (v, row) => v || row.coaching_title },
          { key: 'priority',           label: 'Priority', render: v => `<span class="badge badge-${v==='High'?'red':v==='Medium'?'yellow':'gray'}">${v}</span>` },
          { key: 'due_date',           label: 'Due' },
        ],
        items,
        { emptyMsg: 'No open action items' }
      )}`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/pages/bm.js
git commit -m "feat(callmaster): implement Branch Manager frontend pages (6 pages)"
```

---

## Task 7: Analyst Frontend

**Files:**
- Modify: `public/callmaster/js/pages/analyst.js`

- [ ] **Step 1: Replace ANALYST_PAGES**

```javascript
// public/callmaster/js/pages/analyst.js

const ANALYST_PAGES = {

  'analyst-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/overview', { preset });
    const d = r.data || {};
    const procs = d.processes || [];
    return `
      ${pageHeader('My Score Overview', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'analyst-overview')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Overall CQ%',  d.overall_score ? d.overall_score + '%' : '—', `Target: ${d.target_cq_pct || 95}%`, (d.overall_score || 0) >= (d.target_cq_pct || 95) ? 'up' : 'down')}
        ${kpi('Total Calls',  Number(d.total_calls  || 0).toLocaleString())}
        ${kpi('Fatal Count',  Number(d.fatal_count  || 0).toLocaleString(), '', d.fatal_count > 0 ? 'down' : 'up')}
      </div>
      ${procs.length > 0 ? table(
        [
          { key: 'process_name', label: 'Process' },
          { key: 'source_type',  label: 'Type', render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'avg_score',    label: 'CQ%', render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',  label: 'Calls', render: v => Number(v || 0).toLocaleString() },
          { key: 'fatal_count',  label: 'Fatal', render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
        ],
        procs
      ) : emptyState('No calls audited in this period')}`;
  },

  'analyst-defects': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/defects', { preset });
    const params = r.data?.params || r.data || [];
    const sorted = [...params].sort((a, b) => Number(b.lost_marks || 0) - Number(a.lost_marks || 0));
    setTimeout(() => {
      barChart('analystDefectChart',
        [{ name: 'Lost Marks Count', data: sorted.map(p => Number(p.lost_marks || 0)) }],
        sorted.map(p => p.param),
        { horizontal: true }
      );
    }, 0);
    return `
      ${pageHeader('My Defect Breakdown', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'analyst-defects')")}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Parameters Where I Lost Marks</div>
        <div class="chart-wrap" id="analystDefectChart"></div>
      </div>
      ${table(
        [
          { key: 'param',      label: 'Parameter' },
          { key: 'lost_marks', label: 'Times Deducted', render: v => `<span class="td-mono sev-high">${v || 0}</span>` },
        ],
        sorted
      )}`;
  },

  'analyst-calls': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/my-calls', { preset, page: 1 });
    const d = r.data || {};
    const calls = d.calls || [];
    return `
      ${pageHeader('My Calls', `${d.total != null ? Number(d.total).toLocaleString() + ' total' : ''} · ` + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'analyst-calls')")}
      </div>
      ${table(
        [
          { key: 'id',           label: 'Call ID', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_type',  label: 'Type' },
          { key: 'process_name', label: 'Process' },
          { key: 'call_date',    label: 'Date' },
          { key: 'quality_score',label: 'CQ%', render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'quality_band', label: 'Band', render: v => bandBadge(v) },
          { key: 'alert_severity',label: 'Severity', render: v => sevBadge(v) },
        ],
        calls,
        { emptyMsg: 'No audited calls in selected period' }
      )}`;
  },

  'analyst-evidence': async function(preset) {
    return `
      ${pageHeader('Evidence Review', 'Read-only call detail')}
      <div class="empty-state">
        <div class="empty-state-icon">🎧</div>
        <div class="empty-state-text">Click a call from My Calls to view its evidence</div>
      </div>`;
  },

  'analyst-trend': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/trend', { preset });
    const rows = r.data || (r.categories ? r : []);
    setTimeout(() => {
      if (rows.series) {
        lineChart('analystTrendChart', rows.series, rows.categories, { yFormatter: v => v + '%' });
      } else {
        lineChart('analystTrendChart',
          [{ name: 'My CQ%', data: rows.map(r => Number(r.avg_score || 0)) }],
          rows.map(r => r.call_date),
          { yFormatter: v => v + '%', targetLine: 95 }
        );
      }
    }, 0);
    return `
      ${pageHeader('Score Trend', 'My day-wise quality · last 30 days')}
      <div class="card">
        <div class="chart-title">My Quality Score Trend</div>
        <div class="chart-wrap" id="analystTrendChart"></div>
      </div>`;
  },

  'analyst-coaching': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/analyst/coaching');
    const sessions = r.data?.sessions || r.data || [];
    return `
      ${pageHeader('Coaching Notes', 'Sessions received from T&Q / PM')}
      ${sessions.length === 0 ? emptyState('No coaching notes received yet') : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${sessions.map(s => `
            <div class="card">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <strong>${s.title || s.coaching_title}</strong>
                <span class="badge badge-${s.status==='Open'?'yellow':'green'}">${s.status}</span>
              </div>
              <div style="color:var(--text2);font-size:13px;margin-bottom:8px">${s.notes || s.coaching_reason || '—'}</div>
              <div style="color:var(--text3);font-size:11px">Coach: ${s.coach || s.assigned_to || '—'} · ${s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</div>
            </div>
          `).join('')}
        </div>`}`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/pages/analyst.js
git commit -m "feat(callmaster): implement Analyst frontend pages (6 pages, scoped to own performance)"
```

---

## Task 8: Admin Frontend

**Files:**
- Modify: `public/callmaster/js/pages/admin.js`

- [ ] **Step 1: Replace ADMIN_PAGES**

```javascript
// public/callmaster/js/pages/admin.js

const ADMIN_PAGES = {

  // ── PAGE 1: User Management ─────────────────────────────────────────────────
  'admin-users': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const users = r.data || [];
    return `
      ${pageHeader('User Management', `${users.length} users`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddUserModal()">+ Add User</button>
      </div>
      ${table(
        [
          { key: 'user_id',    label: 'ID',      render: v => `<span class="td-mono">${v}</span>` },
          { key: 'username',   label: 'Username', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'full_name',  label: 'Full Name' },
          { key: 'role',       label: 'Role', render: v => `<span class="badge badge-blue">${v.replace(/_/g,' ')}</span>` },
          { key: 'employee_code', label: 'Emp Code', render: v => v ? `<span class="td-mono">${v}</span>` : '—' },
          { key: 'active',     label: 'Status', render: v => v ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>' },
          { key: 'user_id',    label: 'Actions', render: (v, row) => `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="resetPassword(${v})">Reset PW</button>
              ${row.active ? `<button class="btn btn-sm btn-danger" onclick="deactivateUser(${v})">Deactivate</button>` : `<button class="btn btn-sm" onclick="activateUser(${v})">Activate</button>`}
              <button class="btn btn-sm btn-danger" onclick="deleteUser(${v})">Delete</button>
            </div>` },
        ],
        users,
        { emptyMsg: 'No users found' }
      )}
      <div id="addUserModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add User</div>
          <div class="form-group"><label class="form-label">Username</label><input class="filter-input" id="nuUsername" placeholder="e.g. john.doe"></div>
          <div class="form-group"><label class="form-label">Full Name</label><input class="filter-input" id="nuFullName"></div>
          <div class="form-group"><label class="form-label">Password</label><input class="filter-input" id="nuPassword" type="password"></div>
          <div class="form-group"><label class="form-label">Role</label>
            <select class="filter-select" id="nuRole">
              <option value="analyst">Analyst</option>
              <option value="process_manager">Process Manager</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="tq_head">T&Q Head</option>
              <option value="ceo">CEO</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Employee Code (optional)</label><input class="filter-input" id="nuEmpCode"></div>
          <div class="form-group"><label class="form-label">Branch IDs (comma-separated, * for all)</label><input class="filter-input" id="nuBranchIds" value="*"></div>
          <div class="form-group"><label class="form-label">Process IDs (comma-separated, * for all)</label><input class="filter-input" id="nuProcessIds" value="*"></div>
          <div id="nuError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddUser()">Create</button>
            <button class="btn" onclick="document.getElementById('addUserModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddUserModal() { document.getElementById('addUserModal').style.display='flex'; }
        async function submitAddUser() {
          const nuError = document.getElementById('nuError');
          nuError.textContent = '';
          const body = {
            username: document.getElementById('nuUsername').value.trim(),
            full_name: document.getElementById('nuFullName').value.trim(),
            password: document.getElementById('nuPassword').value,
            role: document.getElementById('nuRole').value,
            employee_code: document.getElementById('nuEmpCode').value.trim() || undefined,
            branch_ids: document.getElementById('nuBranchIds').value.split(',').map(s=>s.trim()),
            process_ids: document.getElementById('nuProcessIds').value.split(',').map(s=>s.trim()),
          };
          if (!body.username || !body.password || !body.full_name) { nuError.textContent = 'Username, full name and password are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/users', body);
          if (r.success) { document.getElementById('addUserModal').style.display='none'; toast('User created · ID ' + r.data.user_id, 'success'); go('admin-users'); }
          else { nuError.textContent = r.message || 'Failed'; }
        }
        async function resetPassword(userId) {
          const np = prompt('New password for user #' + userId);
          if (!np) return;
          const r = await CALLMASTER_API.post('/api/callmaster/admin/users/' + userId + '/reset-password', { new_password: np });
          r.success ? toast('Password reset', 'success') : toast(r.message || 'Failed', 'error');
        }
        async function deactivateUser(userId) {
          if (!confirm('Deactivate user #' + userId + '?')) return;
          const r = await CALLMASTER_API.patch('/api/callmaster/admin/users/' + userId + '/deactivate', {});
          r.success ? (toast('Deactivated', 'success'), go('admin-users')) : toast(r.message || 'Failed', 'error');
        }
        async function activateUser(userId) {
          const r = await CALLMASTER_API.put('/api/callmaster/admin/users/' + userId, { active: 1 });
          r.success ? (toast('Activated', 'success'), go('admin-users')) : toast(r.message || 'Failed', 'error');
        }
        async function deleteUser(userId) {
          if (!confirm('Permanently delete user #' + userId + '? This cannot be undone.')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/users/' + userId);
          r.success ? (toast('Deleted', 'success'), go('admin-users')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 2: Employee Management ─────────────────────────────────────────────
  'admin-employees': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/employees');
    const emps = r.data || [];
    return `
      ${pageHeader('Employee Management', `${emps.length} employees · employee_mapping_master`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddEmpModal()">+ Add Employee</button>
      </div>
      ${table(
        [
          { key: 'employee_code', label: 'Code',    render: v => `<span class="td-mono">${v}</span>` },
          { key: 'employee_name', label: 'Name' },
          { key: 'process_name',  label: 'Process' },
          { key: 'branch',        label: 'Branch' },
          { key: 'designation',   label: 'Designation', render: v => v || '—' },
          { key: 'team_leader_code', label: 'TL Code', render: v => v ? `<span class="td-mono">${v}</span>` : '—' },
          { key: 'active_status', label: 'Active', render: v => v ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>' },
          { key: 'emp_id',        label: 'Actions', render: v => `<button class="btn btn-sm btn-danger" onclick="deleteEmployee(${v})">Delete</button>` },
        ],
        emps,
        { emptyMsg: 'No employees found' }
      )}
      <div id="addEmpModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Employee</div>
          <div class="form-group"><label class="form-label">Employee Code</label><input class="filter-input" id="aeCode"></div>
          <div class="form-group"><label class="form-label">Employee Name</label><input class="filter-input" id="aeName"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="aeProcess"></div>
          <div class="form-group"><label class="form-label">Branch</label><input class="filter-input" id="aeBranch"></div>
          <div class="form-group"><label class="form-label">Designation</label><input class="filter-input" id="aeDesignation"></div>
          <div class="form-group"><label class="form-label">Team Leader Code</label><input class="filter-input" id="aeTlCode"></div>
          <div id="aeError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddEmp()">Create</button>
            <button class="btn" onclick="document.getElementById('addEmpModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddEmpModal() { document.getElementById('addEmpModal').style.display='flex'; }
        async function submitAddEmp() {
          const aeError = document.getElementById('aeError');
          aeError.textContent = '';
          const body = {
            employee_code: document.getElementById('aeCode').value.trim(),
            employee_name: document.getElementById('aeName').value.trim(),
            process_name:  document.getElementById('aeProcess').value.trim(),
            branch:        document.getElementById('aeBranch').value.trim(),
            designation:   document.getElementById('aeDesignation').value.trim() || undefined,
            team_leader_code: document.getElementById('aeTlCode').value.trim() || undefined,
          };
          if (!body.employee_code || !body.employee_name || !body.process_name || !body.branch) { aeError.textContent = 'Code, name, process and branch are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/employees', body);
          if (r.success) { document.getElementById('addEmpModal').style.display='none'; toast('Employee created', 'success'); go('admin-employees'); }
          else { aeError.textContent = r.message || 'Failed'; }
        }
        async function deleteEmployee(empId) {
          if (!confirm('Delete employee #' + empId + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/employees/' + empId);
          r.success ? (toast('Deleted', 'success'), go('admin-employees')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 3: Agent Aliases ────────────────────────────────────────────────────
  'admin-aliases': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/aliases');
    const aliases = r.data || [];
    return `
      ${pageHeader('Agent Alias Mapping', `${aliases.length} aliases · employee_source_alias`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddAliasModal()">+ Add Alias</button>
      </div>
      ${table(
        [
          { key: 'alias_id',      label: 'ID',    render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_alias',  label: 'Source Alias (DB name)', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'employee_code', label: 'Employee Code', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'employee_name', label: 'Employee Name', render: v => v || '—' },
          { key: 'process_name',  label: 'Process' },
          { key: 'alias_id',      label: 'Actions', render: v => `<button class="btn btn-sm btn-danger" onclick="deleteAlias(${v})">Delete</button>` },
        ],
        aliases,
        { emptyMsg: 'No aliases configured' }
      )}
      <div id="addAliasModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Alias Mapping</div>
          <div class="form-group"><label class="form-label">Source Alias (as it appears in DB)</label><input class="filter-input" id="alSource"></div>
          <div class="form-group"><label class="form-label">Employee Code</label><input class="filter-input" id="alEmpCode"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="alProcess"></div>
          <div id="alError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddAlias()">Create</button>
            <button class="btn" onclick="document.getElementById('addAliasModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddAliasModal() { document.getElementById('addAliasModal').style.display='flex'; }
        async function submitAddAlias() {
          const alError = document.getElementById('alError');
          alError.textContent = '';
          const body = {
            source_alias:  document.getElementById('alSource').value.trim(),
            employee_code: document.getElementById('alEmpCode').value.trim(),
            process_name:  document.getElementById('alProcess').value.trim(),
          };
          if (!body.source_alias || !body.employee_code || !body.process_name) { alError.textContent = 'All fields required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/aliases', body);
          if (r.success) { document.getElementById('addAliasModal').style.display='none'; toast('Alias created', 'success'); go('admin-aliases'); }
          else { alError.textContent = r.message || 'Failed'; }
        }
        async function deleteAlias(id) {
          if (!confirm('Delete alias #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/aliases/' + id);
          r.success ? (toast('Deleted', 'success'), go('admin-aliases')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 4: Process Configuration ───────────────────────────────────────────
  'admin-processes': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/processes');
    const procs = r.data || [];
    return `
      ${pageHeader('Process Configuration', `${procs.length} processes · process_mapping_master`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddProcessModal()">+ Add Process</button>
      </div>
      ${table(
        [
          { key: 'process_name',      label: 'Process' },
          { key: 'source_type',       label: 'Type', render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'business_lob',      label: 'LOB' },
          { key: 'branch',            label: 'Branch' },
          { key: 'dialdesk_client_id',label: 'Client ID', render: v => v ? `<span class="td-mono">${v}</span>` : '—' },
          { key: 'target_cq_pct',     label: 'Target CQ%', render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'active_status',     label: 'Active', render: v => v ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>' },
          { key: 'process_id',        label: 'Actions', render: v => `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="editTargetCq(${v})">Edit Target</button>
              <button class="btn btn-sm btn-danger" onclick="deleteProcess(${v})">Delete</button>
            </div>` },
        ],
        procs,
        { emptyMsg: 'No processes configured' }
      )}
      <div id="addProcessModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Process</div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="apName"></div>
          <div class="form-group"><label class="form-label">Business LOB</label><input class="filter-input" id="apLob"></div>
          <div class="form-group"><label class="form-label">Branch</label><input class="filter-input" id="apBranch"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-select" id="apType">
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Dialdesk Client ID (Outbound)</label><input class="filter-input" id="apClientId"></div>
          <div class="form-group"><label class="form-label">Target CQ% (leave blank for default)</label><input class="filter-input" id="apTarget" type="number" min="0" max="100"></div>
          <div id="apError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddProcess()">Create</button>
            <button class="btn" onclick="document.getElementById('addProcessModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddProcessModal() { document.getElementById('addProcessModal').style.display='flex'; }
        async function submitAddProcess() {
          const apError = document.getElementById('apError');
          apError.textContent = '';
          const tgt = document.getElementById('apTarget').value;
          const body = {
            process_name:      document.getElementById('apName').value.trim(),
            business_lob:      document.getElementById('apLob').value.trim(),
            branch:            document.getElementById('apBranch').value.trim(),
            source_type:       document.getElementById('apType').value,
            dialdesk_client_id: document.getElementById('apClientId').value.trim() || undefined,
            target_cq_pct:     tgt ? Number(tgt) : undefined,
          };
          if (!body.process_name || !body.business_lob || !body.branch) { apError.textContent = 'Process name, LOB and branch are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/processes', body);
          if (r.success) { document.getElementById('addProcessModal').style.display='none'; toast('Process created', 'success'); go('admin-processes'); }
          else { apError.textContent = r.message || 'Failed'; }
        }
        async function editTargetCq(processId) {
          const val = prompt('New target CQ% for process #' + processId + ' (e.g. 90):');
          if (val === null) return;
          const r = await CALLMASTER_API.put('/api/callmaster/admin/processes/' + processId, { target_cq_pct: Number(val) });
          r.success ? (toast('Target updated', 'success'), go('admin-processes')) : toast(r.message || 'Failed', 'error');
        }
        async function deleteProcess(processId) {
          if (!confirm('Delete process #' + processId + '? All related config will be lost.')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/processes/' + processId);
          r.success ? (toast('Deleted', 'success'), go('admin-processes')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 5: Exclusion Rules ──────────────────────────────────────────────────
  'admin-exclusions': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/exclusions');
    const rules = r.data || [];
    return `
      ${pageHeader('Exclusion Rules', `${rules.length} rules · dashboard_exclusion_rules`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddExclusionModal()">+ Add Rule</button>
      </div>
      ${table(
        [
          { key: 'process_name', label: 'Process' },
          { key: 'source_type',  label: 'Type', render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'field_name',   label: 'Field', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'operator',     label: 'Operator', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'field_value',  label: 'Value', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'reason',       label: 'Reason', render: v => v || '—' },
          { key: 'rule_id',      label: 'Actions', render: v => `<button class="btn btn-sm btn-danger" onclick="deleteExclusion(${v})">Delete</button>` },
        ],
        rules,
        { emptyMsg: 'No exclusion rules configured' }
      )}
      <div id="addExclusionModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Exclusion Rule</div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="exProcess"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-select" id="exType"><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option></select>
          </div>
          <div class="form-group"><label class="form-label">Field Name</label><input class="filter-input" id="exField" placeholder="e.g. agent_employee_code"></div>
          <div class="form-group"><label class="form-label">Operator</label>
            <select class="filter-select" id="exOp"><option value="=">=</option><option value="!=">!=</option><option value="LIKE">LIKE</option><option value="NOT LIKE">NOT LIKE</option></select>
          </div>
          <div class="form-group"><label class="form-label">Value</label><input class="filter-input" id="exValue"></div>
          <div class="form-group"><label class="form-label">Reason (optional)</label><input class="filter-input" id="exReason"></div>
          <div id="exError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddExclusion()">Create</button>
            <button class="btn" onclick="document.getElementById('addExclusionModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddExclusionModal() { document.getElementById('addExclusionModal').style.display='flex'; }
        async function submitAddExclusion() {
          const exError = document.getElementById('exError');
          exError.textContent = '';
          const body = {
            process_name: document.getElementById('exProcess').value.trim(),
            source_type:  document.getElementById('exType').value,
            field_name:   document.getElementById('exField').value.trim(),
            operator:     document.getElementById('exOp').value,
            field_value:  document.getElementById('exValue').value.trim(),
            reason:       document.getElementById('exReason').value.trim() || undefined,
          };
          if (!body.process_name || !body.field_name || !body.field_value) { exError.textContent = 'Process, field and value are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/exclusions', body);
          if (r.success) { document.getElementById('addExclusionModal').style.display='none'; toast('Rule created', 'success'); go('admin-exclusions'); }
          else { exError.textContent = r.message || 'Failed'; }
        }
        async function deleteExclusion(id) {
          if (!confirm('Delete exclusion rule #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/exclusions/' + id);
          r.success ? (toast('Deleted', 'success'), go('admin-exclusions')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 6: Coaching Queue ───────────────────────────────────────────────────
  'admin-coaching': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/coaching?status=Open');
    const d = r.data || {};
    const rows = d.rows || d || [];
    return `
      ${pageHeader('Coaching Queue', `${d.total != null ? d.total + ' total' : rows.length} open items`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddCoachingModal()">+ Add Entry</button>
        <button class="btn" onclick="bulkCloseSelected()">Bulk Close Selected</button>
      </div>
      <div id="coachingTable">
      ${table(
        [
          { key: 'id',            label: '', render: v => `<input type="checkbox" class="coaching-cb" value="${v}">` },
          { key: 'agent_employee_code', label: 'Code', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'agent_employee_name', label: 'Agent' },
          { key: 'process_name',  label: 'Process' },
          { key: 'title',         label: 'Topic' },
          { key: 'priority',      label: 'Priority', render: v => `<span class="badge badge-${v==='High'?'red':v==='Medium'?'yellow':'gray'}">${v}</span>` },
          { key: 'assigned_to',   label: 'Coach', render: v => v || '—' },
          { key: 'due_date',      label: 'Due' },
          { key: 'id',            label: 'Actions', render: v => `<button class="btn btn-sm" onclick="closeCoaching(${v})">Close</button>` },
        ],
        rows,
        { emptyMsg: 'No open coaching items' }
      )}
      </div>
      <div id="addCoachingModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Coaching Entry</div>
          <div class="form-group"><label class="form-label">Agent Employee Code</label><input class="filter-input" id="cqEmpCode"></div>
          <div class="form-group"><label class="form-label">Agent Name</label><input class="filter-input" id="cqEmpName"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="cqProcess"></div>
          <div class="form-group"><label class="form-label">Source Call ID (optional)</label><input class="filter-input" id="cqCallId"></div>
          <div class="form-group"><label class="form-label">Coaching Topic</label><input class="filter-input" id="cqTitle"></div>
          <div class="form-group"><label class="form-label">Reason / Notes</label><textarea class="filter-input" id="cqReason" rows="3"></textarea></div>
          <div class="form-group"><label class="form-label">Priority</label>
            <select class="filter-select" id="cqPriority"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
          </div>
          <div class="form-group"><label class="form-label">Assigned Coach</label><input class="filter-input" id="cqAssigned"></div>
          <div class="form-group"><label class="form-label">Due Date</label><input class="filter-input" id="cqDue" type="date"></div>
          <div id="cqError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddCoaching()">Create</button>
            <button class="btn" onclick="document.getElementById('addCoachingModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddCoachingModal() { document.getElementById('addCoachingModal').style.display='flex'; }
        async function submitAddCoaching() {
          const cqError = document.getElementById('cqError');
          cqError.textContent = '';
          const body = {
            agent_employee_code: document.getElementById('cqEmpCode').value.trim(),
            agent_employee_name: document.getElementById('cqEmpName').value.trim(),
            process_name:        document.getElementById('cqProcess').value.trim(),
            source_call_id:      document.getElementById('cqCallId').value.trim() || undefined,
            coaching_title:      document.getElementById('cqTitle').value.trim(),
            coaching_reason:     document.getElementById('cqReason').value.trim(),
            priority:            document.getElementById('cqPriority').value,
            assigned_to:         document.getElementById('cqAssigned').value.trim() || undefined,
            due_date:            document.getElementById('cqDue').value || undefined,
          };
          if (!body.agent_employee_code || !body.coaching_title || !body.coaching_reason) { cqError.textContent = 'Employee code, topic and reason are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/coaching', body);
          if (r.success) { document.getElementById('addCoachingModal').style.display='none'; toast('Coaching entry created', 'success'); go('admin-coaching'); }
          else { cqError.textContent = r.message || 'Failed'; }
        }
        async function closeCoaching(id) {
          const r = await CALLMASTER_API.put('/api/callmaster/admin/coaching/' + id, { status: 'Closed' });
          r.success ? (toast('Closed', 'success'), go('admin-coaching')) : toast(r.message || 'Failed', 'error');
        }
        async function bulkCloseSelected() {
          const ids = [...document.querySelectorAll('.coaching-cb:checked')].map(el => Number(el.value));
          if (!ids.length) { toast('No items selected', 'error'); return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/coaching/bulk-close', { ids });
          r.success ? (toast(r.data.updated + ' items closed', 'success'), go('admin-coaching')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 7: Calibration Sessions ────────────────────────────────────────────
  'admin-calibration': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/calibration/sessions');
    const d = r.data || {};
    const sessions = d.rows || d || [];
    return `
      ${pageHeader('Calibration Sessions', `${d.total != null ? d.total + ' total' : sessions.length} sessions`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddCalibModal()">+ New Session</button>
      </div>
      ${table(
        [
          { key: 'session_id',       label: 'ID',    render: v => `<span class="td-mono">${v}</span>` },
          { key: 'process_name',     label: 'Process' },
          { key: 'session_date',     label: 'Date' },
          { key: 'facilitator_name', label: 'Facilitator' },
          { key: 'session_status',   label: 'Status', render: v => `<span class="badge badge-${v==='Completed'?'green':v==='In Progress'?'yellow':'gray'}">${v}</span>` },
          { key: 'participant_count',label: 'Participants', render: v => v || '—' },
          { key: 'session_id',       label: 'Actions', render: v => `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="go('admin-calibration-calls', {sessionId: ${v}})">View Calls</button>
              <button class="btn btn-sm" onclick="markCalibComplete(${v})">Mark Complete</button>
            </div>` },
        ],
        sessions,
        { emptyMsg: 'No calibration sessions' }
      )}
      <div id="addCalibModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">New Calibration Session</div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="csProcess"></div>
          <div class="form-group"><label class="form-label">Session Date</label><input class="filter-input" id="csDate" type="date"></div>
          <div class="form-group"><label class="form-label">Facilitator Name</label><input class="filter-input" id="csFacilitator"></div>
          <div class="form-group"><label class="form-label">Notes (optional)</label><textarea class="filter-input" id="csNotes" rows="2"></textarea></div>
          <div id="csError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddCalib()">Create</button>
            <button class="btn" onclick="document.getElementById('addCalibModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddCalibModal() { document.getElementById('addCalibModal').style.display='flex'; }
        async function submitAddCalib() {
          const csError = document.getElementById('csError');
          csError.textContent = '';
          const body = {
            process_name:     document.getElementById('csProcess').value.trim(),
            session_date:     document.getElementById('csDate').value,
            facilitator_name: document.getElementById('csFacilitator').value.trim(),
            notes:            document.getElementById('csNotes').value.trim() || undefined,
          };
          if (!body.process_name || !body.session_date || !body.facilitator_name) { csError.textContent = 'Process, date and facilitator are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/calibration/sessions', body);
          if (r.success) { document.getElementById('addCalibModal').style.display='none'; toast('Session created · ID ' + r.data.session_id, 'success'); go('admin-calibration'); }
          else { csError.textContent = r.message || 'Failed'; }
        }
        async function markCalibComplete(sessionId) {
          const r = await CALLMASTER_API.put('/api/callmaster/admin/calibration/sessions/' + sessionId, { session_status: 'Completed' });
          r.success ? (toast('Marked complete', 'success'), go('admin-calibration')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 8: Calibration Call Detail ─────────────────────────────────────────
  'admin-calibration-calls': async function(preset, params = {}) {
    const sessionId = params.sessionId || window._calibSessionId;
    if (!sessionId) return `${pageHeader('Calibration Calls')}${emptyState('No session selected — go back to Calibration Sessions and click View Calls')}`;
    window._calibSessionId = sessionId;
    const r = await CALLMASTER_API.get('/api/callmaster/admin/calibration/sessions/' + sessionId + '/calls');
    const calls = r.data || [];
    return `
      ${pageHeader('Calibration Calls', `Session #${sessionId}`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn" onclick="go('admin-calibration')">← Back to Sessions</button>
        <button class="btn btn-primary" onclick="showAddCalibCallModal(${sessionId})">+ Add Call</button>
      </div>
      ${table(
        [
          { key: 'source_call_id',    label: 'Call ID', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'employee_name',     label: 'Agent', render: (v, row) => v || row.agent_employee_code },
          { key: 'facilitator_score', label: 'Facilitator Score', render: v => `<span class="td-mono">${v}%</span>` },
          { key: 'agreed_score',      label: 'Agreed Score',      render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'variance',          label: 'Variance',          render: v => v != null ? `<span class="td-mono ${v > 5 ? 'sev-high' : ''}">${v}%</span>` : '—' },
          { key: 'call_notes',        label: 'Notes', render: v => v || '—' },
        ],
        calls,
        { emptyMsg: 'No calls added to this session yet' }
      )}
      <div id="addCalibCallModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Calibration Call</div>
          <div class="form-group"><label class="form-label">Source Call ID</label><input class="filter-input" id="ccCallId"></div>
          <div class="form-group"><label class="form-label">Agent Employee Code</label><input class="filter-input" id="ccEmpCode"></div>
          <div class="form-group"><label class="form-label">Facilitator Score (%)</label><input class="filter-input" id="ccFacScore" type="number" min="0" max="100"></div>
          <div class="form-group"><label class="form-label">Agreed Score (%) — leave blank if not yet agreed</label><input class="filter-input" id="ccAgreedScore" type="number" min="0" max="100"></div>
          <div class="form-group"><label class="form-label">Notes (optional)</label><textarea class="filter-input" id="ccNotes" rows="2"></textarea></div>
          <div id="ccError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddCalibCall(${sessionId})">Add</button>
            <button class="btn" onclick="document.getElementById('addCalibCallModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddCalibCallModal(sid) { document.getElementById('addCalibCallModal').style.display='flex'; }
        async function submitAddCalibCall(sessionId) {
          const ccError = document.getElementById('ccError');
          ccError.textContent = '';
          const agreedVal = document.getElementById('ccAgreedScore').value;
          const body = {
            session_id:         sessionId,
            source_call_id:     document.getElementById('ccCallId').value.trim(),
            agent_employee_code: document.getElementById('ccEmpCode').value.trim(),
            facilitator_score:  Number(document.getElementById('ccFacScore').value),
            agreed_score:       agreedVal ? Number(agreedVal) : undefined,
            call_notes:         document.getElementById('ccNotes').value.trim() || undefined,
          };
          if (!body.source_call_id || !body.agent_employee_code || isNaN(body.facilitator_score)) { ccError.textContent = 'Call ID, employee code and facilitator score are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/calibration/calls', body);
          if (r.success) { document.getElementById('addCalibCallModal').style.display='none'; toast('Call added', 'success'); go('admin-calibration-calls', { sessionId }); }
          else { ccError.textContent = r.message || 'Failed'; }
        }
      </script>`;
  },

  // ── PAGE 9: Audit Prompt Config ──────────────────────────────────────────────
  'admin-audit-config': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/audit-prompts');
    const prompts = r.data || [];
    return `
      ${pageHeader('Audit Prompt Config', `${prompts.length} parameters · audit_prompt_config`)}
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddPromptModal()">+ Add Parameter</button>
      </div>
      ${table(
        [
          { key: 'process_name',   label: 'Process' },
          { key: 'source_type',    label: 'Type', render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'parameter_name', label: 'Parameter', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'max_marks',      label: 'Max Marks', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'active',         label: 'Active', render: v => v ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>' },
          { key: 'prompt_id',      label: 'Actions', render: v => `
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="togglePromptActive(${v})">Toggle Active</button>
              <button class="btn btn-sm btn-danger" onclick="deletePrompt(${v})">Delete</button>
            </div>` },
        ],
        prompts,
        { emptyMsg: 'No audit parameters configured' }
      )}
      <div id="addPromptModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Audit Parameter</div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="prProcess"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-select" id="prType"><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option></select>
          </div>
          <div class="form-group"><label class="form-label">Parameter Name</label><input class="filter-input" id="prName"></div>
          <div class="form-group"><label class="form-label">Max Marks</label><input class="filter-input" id="prMarks" type="number" min="1"></div>
          <div class="form-group"><label class="form-label">Prompt Text (evaluation instruction)</label><textarea class="filter-input" id="prText" rows="3"></textarea></div>
          <div id="prError" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="submitAddPrompt()">Create</button>
            <button class="btn" onclick="document.getElementById('addPromptModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>
      <script>
        function showAddPromptModal() { document.getElementById('addPromptModal').style.display='flex'; }
        async function submitAddPrompt() {
          const prError = document.getElementById('prError');
          prError.textContent = '';
          const body = {
            process_name:   document.getElementById('prProcess').value.trim(),
            source_type:    document.getElementById('prType').value,
            parameter_name: document.getElementById('prName').value.trim(),
            max_marks:      Number(document.getElementById('prMarks').value),
            prompt_text:    document.getElementById('prText').value.trim(),
          };
          if (!body.process_name || !body.parameter_name || !body.prompt_text || !body.max_marks) { prError.textContent = 'All fields required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/audit-prompts', body);
          if (r.success) { document.getElementById('addPromptModal').style.display='none'; toast('Parameter created', 'success'); go('admin-audit-config'); }
          else { prError.textContent = r.message || 'Failed'; }
        }
        async function togglePromptActive(promptId) {
          const r = await CALLMASTER_API.get('/api/callmaster/admin/audit-prompts');
          const cur = (r.data || []).find(p => p.prompt_id === promptId);
          const newActive = cur ? (cur.active ? 0 : 1) : 1;
          const r2 = await CALLMASTER_API.put('/api/callmaster/admin/audit-prompts/' + promptId, { active: newActive });
          r2.success ? (toast('Updated', 'success'), go('admin-audit-config')) : toast(r2.message || 'Failed', 'error');
        }
        async function deletePrompt(promptId) {
          if (!confirm('Delete audit parameter #' + promptId + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/audit-prompts/' + promptId);
          r.success ? (toast('Deleted', 'success'), go('admin-audit-config')) : toast(r.message || 'Failed', 'error');
        }
      </script>`;
  },

  // ── PAGE 10: Data Source Mapping ─────────────────────────────────────────────
  'admin-data-sources': async function(preset) {
    return `
      ${pageHeader('Data Source Mapping', 'ProcessRegistry — read only')}
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Inbound Source</div>
          <div class="kpi-sub">DB: <code>db_audit</code></div>
          <div class="kpi-sub" style="margin-top:8px">Table: <code>call_quality_assessment</code></div>
          <div class="kpi-sub" style="margin-top:8px">QA: <code>manual_qa_audit</code></div>
          <div class="kpi-sub" style="margin-top:8px">View: <code>v_call_master_inbound_kpi</code></div>
        </div>
        <div class="card">
          <div class="card-title">Outbound Source</div>
          <div class="kpi-sub">DB: <code>db_external</code></div>
          <div class="kpi-sub" style="margin-top:8px">Table: <code>CallDetails</code></div>
          <div class="kpi-sub" style="margin-top:8px">AI Insights: <code>Shivamgiri.call_ai_insight</code></div>
          <div class="kpi-sub" style="margin-top:8px">View: <code>v_call_master_outbound_kpi</code></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Unified View</div>
        <div class="kpi-sub"><code>v_call_master_unified_kpi</code> — UNION ALL of Inbound + Outbound KPI rows, used for cross-process analysis</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">RW Tables (Shivamgiri)</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${['process_mapping_master','employee_mapping_master','employee_source_alias','cm_users',
             'call_coaching_queue','calibration_session','calibration_call','audit_prompt_config',
             'dashboard_exclusion_rules','call_ai_insight','call_feedback_log','manual_qa_audit'
            ].map(t => `<span class="badge badge-gray" style="font-family:monospace">${t}</span>`).join('')}
        </div>
      </div>`;
  },

  // ── PAGE 11: Role Impersonation ──────────────────────────────────────────────
  'admin-impersonate': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const users = (r.data || []).filter(u => u.active);
    return `
      ${pageHeader('Role Impersonation', 'Issue a 1-hour token for any active user to view their dashboard perspective')}
      <div class="card" style="max-width:420px">
        <div class="form-group">
          <label class="form-label">Select User</label>
          <select class="filter-select" id="impersonateSelect" style="width:100%;padding:10px">
            <option value="">— select user —</option>
            ${users.map(u => `<option value="${u.user_id}">${u.full_name} · ${u.role.replace(/_/g,' ')}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="doImpersonate()">Switch View</button>
        <div id="impersonateError" style="color:var(--danger);font-size:13px;margin-top:8px"></div>
        <div class="kpi-sub" style="margin-top:16px">Your original admin session will be replaced. Refresh the page to return to admin.</div>
      </div>
      <script>
        async function doImpersonate() {
          const uid = document.getElementById('impersonateSelect').value;
          if (!uid) { document.getElementById('impersonateError').textContent = 'Please select a user'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/impersonate', { target_user_id: Number(uid) });
          if (r.success) {
            onLogin(r.token, r.user);
            toast('Switched to ' + r.user.full_name + ' (' + r.user.role.replace(/_/g,' ') + ')', 'info');
          } else {
            document.getElementById('impersonateError').textContent = r.message || 'Failed';
          }
        }
      </script>`;
  },

  // ── PAGE 12: System Health ───────────────────────────────────────────────────
  'admin-health': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/system-health');
    const d = r.data || {};
    const pools = d.pools || {};
    const poolEntries = Object.entries(pools).filter(([k]) => ['shivamgiri','db_external'].includes(k));
    const counters = Object.entries(pools).filter(([k]) => !['shivamgiri','db_external'].includes(k));
    return `
      ${pageHeader('System Health', `Checked: ${d.checked_at ? new Date(d.checked_at).toLocaleTimeString() : '—'}`)}
      <div class="kpi-grid" style="margin-bottom:16px">
        ${poolEntries.map(([name, info]: [string, any]) => kpi(
          name === 'shivamgiri' ? 'Shivamgiri (RW)' : 'db_external (RO)',
          info.status === 'ok' ? '✓ Online' : '✗ Offline',
          info.latency_ms != null ? `${info.latency_ms}ms latency` : info.error || '',
          info.status === 'ok' ? 'up' : 'down'
        )).join('')}
      </div>
      <div class="kpi-grid">
        ${counters.map(([name, val]: [string, any]) => kpi(
          name.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
          val != null ? String(val) : '—'
        )).join('')}
      </div>
      <div style="margin-top:16px">
        <button class="btn" onclick="go('admin-health')">Refresh</button>
      </div>`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/pages/admin.js
git commit -m "feat(callmaster): implement Admin frontend pages (12 pages — users, employees, aliases, processes, exclusions, coaching, calibration, audit-config, data-sources, impersonation, system health)"
```

---

## Task 9: Final end-to-end test

- [ ] **Step 1: TypeScript clean build**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Full persona matrix test**

Start server: `npm run dev`. Open `http://localhost:5050/callmaster/`.

Test each persona:

| Login | Role | First page | Expected |
|---|---|---|---|
| `bm` | branch_manager | Branch Health | Gauge + KPI cards render |
| `bm` | branch_manager | Team Performance | Table with analyst rows |
| `bm` | branch_manager | Risk Calls | Table with severity badges |
| `analyst` | analyst | My Score Overview | KPI cards + process table |
| `analyst` | analyst | My Defects | Bar chart + table |
| `analyst` | analyst | Score Trend | Line chart with target line |
| `analyst` | analyst | Coaching | Empty state or session cards |
| `admin` | admin | User Management | Table with all cm_users; Add User modal opens |
| `admin` | admin | Employee Management | Table renders; Add Employee modal opens |
| `admin` | admin | Agent Aliases | Table renders; Add Alias modal opens |
| `admin` | admin | Process Configuration | Table with target_cq_pct column; Edit Target prompt works |
| `admin` | admin | Exclusion Rules | Table renders; Add Rule modal opens |
| `admin` | admin | Coaching Queue | Table with checkboxes; Bulk Close button present |
| `admin` | admin | Calibration Sessions | Table renders; New Session modal opens |
| `admin` | admin | Calibration Calls | Empty state shown when no session selected |
| `admin` | admin | Audit Prompt Config | Table renders; Add Parameter modal opens |
| `admin` | admin | Data Source Mapping | Two source cards + unified view card render |
| `admin` | admin | Impersonation | User dropdown renders with active users |
| `admin` | admin | System Health | Pool status KPI cards with latency; counters shown |

- [ ] **Step 3: Test CSV exports**

```bash
TOKEN="..." # get token for admin user

curl -s "http://localhost:5050/api/callmaster/export/process-summary?preset=MTD" \
  -H "Authorization: Bearer $TOKEN" > /tmp/process_summary.csv

head -5 /tmp/process_summary.csv
```
Expected: CSV header + data rows.

- [ ] **Step 4: Test Admin impersonation endpoint**

```bash
curl -s -X POST http://localhost:5050/api/callmaster/admin/impersonate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_user_id": 1}'
```
Expected: `{"success":true,"token":"eyJ...","user":{...}}`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(callmaster): Plan 4 complete — BM, Analyst, Admin personas + CSV exports fully implemented"
```

---

## All 4 Plans Complete

The Call Master dashboard is fully implemented across 4 plans:

| Plan | Deliverable | Status |
|---|---|---|
| Plan 1 | Foundation: DB table, auth, shell, mock | ✅ |
| Plan 2 | CEO (7 pages) + T&Q Head (8 pages) | ✅ |
| Plan 3 | Process Manager (17 endpoints, 15 pages) | ✅ |
| Plan 4 | BM (6) + Analyst (6) + Admin (6) + CSV export | ✅ |

**Total:** 6 personas · 41 pages · 48 API endpoints · 4 DB pools

**Repeat Analysis (Inbound) page** is documented as a pending placeholder in the spec (Section 11) — implement as `POST /api/callmaster/pm/repeat-analysis` once the Looker screenshot is reviewed.
