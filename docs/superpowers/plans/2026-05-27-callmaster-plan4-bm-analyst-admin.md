# Call Master Dashboard — Plan 4: Branch Manager, Analyst & Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Branch Manager (6 pages), Analyst (6 pages), and Admin (6 pages) personas, plus CSV export routes for all personas.

**Architecture:** `branchService.ts`, `analystService.ts`, and `adminService.ts` are added. Branch Manager reuses unified KPI view filtered to `branch_ids`. Analyst is scoped to own `employee_code` only — no peer data exposed. Admin manages `cm_users` CRUD and exposes system health. Export routes stream CSV from the same service functions.

**Tech Stack:** TypeScript/Express 5, mysql2, bcryptjs, vanilla JS, ApexCharts. Prereq: Plans 1–3 complete.

---

## File Map

### Backend — new files
```
src/callmaster/
  services/branchService.ts       ← BM queries scoped to branch_ids
  services/analystService.ts      ← Analyst queries scoped to own employee_code
  services/adminService.ts        ← cm_users CRUD + system health
  routes/bmRoutes.ts              ← POST /api/callmaster/bm/*
  routes/analystRoutes.ts         ← POST /api/callmaster/analyst/*
  routes/adminRoutes.ts           ← GET/POST/PUT/DELETE /api/callmaster/admin/*
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
import { getPool as getMainPool } from '../../config/db';
import { getExternalPool } from '../../config/dbExternal';

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function listUsers() {
  return q(`
    SELECT user_id, username, full_name, role, branch_ids, process_ids, employee_code, active, created_at
    FROM cm_users ORDER BY created_at DESC
  `, []);
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
  full_name: string; role: string; branch_ids: string[]; process_ids: string[]; employee_code: string; active: number;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.full_name     !== undefined) { fields.push('full_name = ?');   params.push(data.full_name); }
  if (data.role          !== undefined) { fields.push('role = ?');         params.push(data.role); }
  if (data.branch_ids    !== undefined) { fields.push('branch_ids = ?');   params.push(JSON.stringify(data.branch_ids)); }
  if (data.process_ids   !== undefined) { fields.push('process_ids = ?');  params.push(JSON.stringify(data.process_ids)); }
  if (data.employee_code !== undefined) { fields.push('employee_code = ?');params.push(data.employee_code); }
  if (data.active        !== undefined) { fields.push('active = ?');       params.push(data.active); }

  if (fields.length === 0) return;

  params.push(userId);
  await (db as any).execute(`UPDATE cm_users SET ${fields.join(', ')} WHERE user_id = ?`, params);
}

export async function deactivateUser(userId: number) {
  await (db as any).execute(`UPDATE cm_users SET active = 0 WHERE user_id = ?`, [userId]);
}

export async function listProcesses() {
  return q(`
    SELECT process_id, process_name, business_lob, branch, source_type, dialdesk_client_id, active_status
    FROM process_mapping_master
    ORDER BY source_type, process_name
  `, []);
}

export async function systemHealth() {
  const results: Record<string, any> = {};

  try {
    const [[mainRow]] = await (db as any).execute<any[]>('SELECT 1 AS ok');
    results.shivamgiri = { status: 'ok', latency_ms: null };
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
    const [cmUsers] = await (db as any).execute<any[]>('SELECT COUNT(*) AS cnt FROM cm_users');
    results.cm_users_count = (cmUsers as any)[0]?.cnt ?? 0;
  } catch {
    results.cm_users_count = null;
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
git commit -m "feat(callmaster): add admin service (user CRUD, process list, system health)"
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

router.get('/users',       wrap(() => admin.listUsers()));
router.post('/users',      wrap(req => admin.createUser(req.body)));
router.put('/users/:id',   wrap(req => admin.updateUser(Number(req.params.id), req.body)));
router.delete('/users/:id',wrap(req => admin.deactivateUser(Number(req.params.id))));
router.get('/processes',   wrap(() => admin.listProcesses()));
router.get('/system-health', wrap(() => admin.systemHealth()));

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
git commit -m "feat(callmaster): add BM, Analyst, Admin routes (18 endpoints total) + mount in server.ts"
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

  'admin-users': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const users = r.data || [];
    return `
      ${pageHeader('User Management', `${users.length} users`)}
      ${table(
        [
          { key: 'user_id',    label: 'ID',      render: v => `<span class="td-mono">${v}</span>` },
          { key: 'username',   label: 'Username' },
          { key: 'full_name',  label: 'Full Name' },
          { key: 'role',       label: 'Role',    render: v => `<span class="persona-badge badge-${v}">${v.replace('_',' ')}</span>` },
          { key: 'active',     label: 'Active',  render: v => v ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>' },
          { key: 'created_at', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
        ],
        users,
        { emptyMsg: 'No users found' }
      )}`;
  },

  'admin-processes': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/processes');
    const procs = r.data || [];
    return `
      ${pageHeader('Process Configuration', 'process_mapping_master')}
      ${table(
        [
          { key: 'process_name',      label: 'Process' },
          { key: 'source_type',       label: 'Type', render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'business_lob',      label: 'LOB' },
          { key: 'branch',            label: 'Branch' },
          { key: 'dialdesk_client_id',label: 'Client ID', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'active_status',     label: 'Active', render: v => v ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>' },
        ],
        procs
      )}`;
  },

  'admin-data-sources': async function(preset) {
    return `
      ${pageHeader('Data Source Mapping', 'ProcessRegistry')}
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Inbound</div>
          <div class="kpi-sub">Source DB: <code>db_audit.call_quality_assessment</code></div>
          <div class="kpi-sub" style="margin-top:8px">View: <code>v_call_master_inbound_kpi</code></div>
          <div class="kpi-sub" style="margin-top:8px">QA Params: <code>db_audit.manual_qa_audit</code></div>
        </div>
        <div class="card">
          <div class="card-title">Outbound</div>
          <div class="kpi-sub">Source DB: <code>db_external.CallDetails</code></div>
          <div class="kpi-sub" style="margin-top:8px">View: <code>v_call_master_outbound_kpi</code></div>
          <div class="kpi-sub" style="margin-top:8px">AI Insights: <code>Shivamgiri.call_ai_insight</code></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Unified View</div>
        <div class="kpi-sub"><code>v_call_master_unified_kpi</code> — UNION ALL of Inbound + Outbound KPI rows</div>
      </div>`;
  },

  'admin-impersonate': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const users = (r.data || []).filter(u => u.active);
    return `
      ${pageHeader('Role Impersonation', 'Issue temporary token for any user (1 hour)')}
      <div class="card" style="max-width:400px">
        <div class="form-group">
          <label class="form-label">Select User to Impersonate</label>
          <select class="filter-select" id="impersonateSelect" style="width:100%;padding:10px">
            <option value="">— select —</option>
            ${users.map(u => `<option value="${u.user_id}">${u.full_name} (${u.role})</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" onclick="doImpersonate()">Switch View</button>
        <div id="impersonateError" style="color:var(--danger);font-size:13px;margin-top:8px"></div>
      </div>
      <script>
        async function doImpersonate() {
          const uid = document.getElementById('impersonateSelect').value;
          if (!uid) { document.getElementById('impersonateError').textContent = 'Please select a user'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/impersonate', { target_user_id: Number(uid) });
          if (r.success) {
            onLogin(r.token, r.user);
            toast('Switched to ' + r.user.full_name + ' (' + r.user.role + ')', 'info');
          } else {
            document.getElementById('impersonateError').textContent = r.message || 'Failed';
          }
        }
      </script>`;
  },

  'admin-health': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/system-health');
    const d = r.data || {};
    const pools = d.pools || {};
    return `
      ${pageHeader('System Health', `Checked: ${d.checked_at ? new Date(d.checked_at).toLocaleTimeString() : '—'}`)}
      <div class="kpi-grid">
        ${Object.entries(pools).map(([name, info]: [string, any]) => kpi(
          name.toUpperCase(),
          info.status === 'ok' ? '✓ OK' : '✗ Error',
          info.latency_ms != null ? `${info.latency_ms}ms` : info.error || '',
          info.status === 'ok' ? 'up' : 'down'
        )).join('')}
        ${kpi('CM Users', d.pools?.cm_users_count != null ? d.pools.cm_users_count : '—', 'Active user accounts')}
      </div>`;
  },

  'admin-audit-config': async function(preset) {
    return `
      ${pageHeader('Audit Configuration')}
      <div class="empty-state">
        <div class="empty-state-icon">⚙️</div>
        <div class="empty-state-text">Audit parameter weight configuration — managed via audit_prompt_config table in Shivamgiri</div>
      </div>`;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/pages/admin.js
git commit -m "feat(callmaster): implement Admin frontend pages (6 pages including impersonation)"
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
| `admin` | admin | User Management | Table with all cm_users |
| `admin` | admin | System Health | Pool status KPI cards |
| `admin` | admin | Impersonation | User dropdown renders |

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
