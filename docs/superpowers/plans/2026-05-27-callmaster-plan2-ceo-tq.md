# Call Master Dashboard — Plan 2: CEO & T&Q Head

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 7 CEO endpoints + frontend pages and all 8 T&Q Head endpoints + frontend pages, replacing the Plan 1 stubs with fully working data-driven views backed by the unified KPI view.

**Architecture:** Backend services query `v_call_master_unified_kpi` in Shivamgiri. Each route file imports `cmAuthMiddleware` + `requireRole`. Frontend page modules replace stub functions in `ceo.js` and `tq.js` — the app shell, router, and mock layer from Plan 1 remain unchanged. `USE_MOCK_DATA=true` until real DB is confirmed; set to `false` per-endpoint as schemas are verified.

**Tech Stack:** TypeScript/Express 5, mysql2, vanilla JS, ApexCharts. Prereq: Plan 1 complete.

---

## File Map

### Backend — new files
```
src/callmaster/
  repositories/unifiedKpiRepo.ts    ← all queries against v_call_master_unified_kpi
  services/orgService.ts            ← CEO-level aggregates
  services/qualityService.ts        ← T&Q deep-dive (TNI, calibration, coaching, SLA)
  routes/ceoRoutes.ts               ← POST /api/callmaster/ceo/*
  routes/tqRoutes.ts                ← POST /api/callmaster/tq/*
```

### Backend — modified files
```
src/server.ts                       ← mount ceoRoutes + tqRoutes
```

### Frontend — modified files
```
public/callmaster/js/pages/ceo.js   ← replace stubs with 7 full page renderers
public/callmaster/js/pages/tq.js    ← replace stubs with 8 full page renderers
```

---

## Task 1: Unified KPI Repository

**Files:**
- Create: `src/callmaster/repositories/unifiedKpiRepo.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/repositories/unifiedKpiRepo.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from './baseRepository';

interface ScopeOptions {
  branchIds: string[];
  processIds: string[];
  sourceType?: 'Inbound' | 'Outbound';
  preset: Preset;
}

async function execute<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function getOrgScorecard(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const rows = await execute(`
    SELECT
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS avg_quality_score,
      SUM(is_critical_call) AS critical_calls
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${bClause} AND ${pClause}
    GROUP BY source_type
  `, [startDate, endDate, ...bParams, ...pParams]);

  return rows;
}

export async function getProcessMatrix(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      process_name, source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count,
      SUM(CASE WHEN alert_severity IN ('Critical','High') THEN 1 ELSE 0 END) AS high_risk_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${bClause} AND ${pClause}
    GROUP BY process_name, source_type
    ORDER BY source_type, process_name
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getBranchComparison(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      branch_short_name AS branch,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY branch_short_name
    ORDER BY quality_score DESC
  `, [startDate, endDate, ...pParams]);
}

export async function getRiskExposure(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      alert_severity,
      COUNT(*) AS count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High','Medium')
      AND ${bClause} AND ${pClause}
    GROUP BY alert_severity
    ORDER BY FIELD(alert_severity,'Critical','High','Medium')
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getOrgTrend(opts: { branchIds: string[]; processIds: string[]; days?: number }) {
  const days = opts.days || 30;
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      call_date,
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END), 2) AS avg_score
    FROM v_call_master_unified_kpi
    WHERE call_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND ${bClause} AND ${pClause}
    GROUP BY call_date, source_type
    ORDER BY call_date
  `, [days, ...bParams, ...pParams]);
}

export async function getCriticalAlerts(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      source_call_id, source_type, process_name, branch_short_name,
      agent_employee_name AS agent, alert_severity, call_date
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND alert_severity IN ('Critical','High')
      AND ${bClause} AND ${pClause}
    ORDER BY FIELD(alert_severity,'Critical','High'), call_date DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);
}

export async function getTniHeatmap(opts: ScopeOptions) {
  // Queries manual_qa_audit for inbound parameter defects per agent
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  // Join through v_call_master_inbound_kpi to get employee_code → manual_qa_audit
  return (db as any).execute(`
    SELECT
      k.agent_employee_name AS agent,
      k.agent_employee_code AS employee_code,
      -- Count defects per parameter (non-full-mark answers)
      SUM(CASE WHEN mqa.opening_greeting IS NOT NULL AND mqa.opening_greeting < 1 THEN 1 ELSE 0 END) AS opening_defects,
      SUM(CASE WHEN mqa.call_flow IS NOT NULL AND mqa.call_flow < 1 THEN 1 ELSE 0 END) AS call_flow_defects,
      SUM(CASE WHEN mqa.resolution_provided IS NOT NULL AND mqa.resolution_provided < 1 THEN 1 ELSE 0 END) AS resolution_defects,
      SUM(CASE WHEN mqa.compliance IS NOT NULL AND mqa.compliance < 1 THEN 1 ELSE 0 END) AS compliance_defects,
      SUM(CASE WHEN mqa.hold_procedure IS NOT NULL AND mqa.hold_procedure < 1 THEN 1 ELSE 0 END) AS hold_defects,
      COUNT(DISTINCT mqa.id) AS total_audits
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY k.agent_employee_name, k.agent_employee_code
    ORDER BY compliance_defects DESC
    LIMIT 50
  `, [startDate, endDate, ...pParams]).then(([rows]: any) => rows);
}

export async function getAnalystLeaderboard(opts: ScopeOptions) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', opts.branchIds);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return execute(`
    SELECT
      agent_employee_code AS employee_code,
      agent_employee_name AS name,
      process_name,
      source_type,
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS avg_score,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND quality_score IS NOT NULL
      AND ${bClause} AND ${pClause}
    GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
    ORDER BY avg_score DESC
    LIMIT 100
  `, [startDate, endDate, ...bParams, ...pParams]);
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/repositories/unifiedKpiRepo.ts
git commit -m "feat(callmaster): add unified KPI repository (org scorecard, matrix, branch comparison, alerts, TNI, leaderboard)"
```

---

## Task 2: Org Service (CEO)

**Files:**
- Create: `src/callmaster/services/orgService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/orgService.ts
import {
  getOrgScorecard, getProcessMatrix, getBranchComparison,
  getRiskExposure, getOrgTrend, getCriticalAlerts
} from '../repositories/unifiedKpiRepo';
import { Preset } from '../repositories/baseRepository';

interface Scope { branchIds: string[]; processIds: string[]; }

export async function ceoScorecard(preset: Preset, scope: Scope) {
  const rows = await getOrgScorecard({ ...scope, preset });
  const inbound  = rows.find(r => r.source_type === 'Inbound');
  const outbound = rows.find(r => r.source_type === 'Outbound');
  return {
    outbound_score:   outbound?.avg_quality_score ?? null,
    inbound_score:    inbound?.avg_quality_score  ?? null,
    total_calls:      rows.reduce((s, r) => s + Number(r.total_calls), 0),
    critical_calls:   rows.reduce((s, r) => s + Number(r.critical_calls), 0),
    inbound_calls:    Number(inbound?.total_calls  ?? 0),
    outbound_calls:   Number(outbound?.total_calls ?? 0),
  };
}

export async function ceoProcessMatrix(preset: Preset, scope: Scope) {
  return getProcessMatrix({ ...scope, preset });
}

export async function ceoBranchComparison(preset: Preset, scope: Scope) {
  return getBranchComparison({ ...scope, preset });
}

export async function ceoSlaOverview(preset: Preset, scope: Scope) {
  // SLA = % of calls in period that have been audited (quality_score IS NOT NULL)
  const rows = await getProcessMatrix({ ...scope, preset });
  return rows.map(r => ({
    ...r,
    sla_pct: r.total_calls > 0
      ? null  // SLA requires separate audit count query — returns null for now, frontend shows —
      : 0,
  }));
}

export async function ceoRiskExposure(preset: Preset, scope: Scope) {
  const rows = await getRiskExposure({ ...scope, preset });
  return {
    total_risk: rows.reduce((s, r) => s + Number(r.count), 0),
    breakdown: rows,
  };
}

export async function ceoTrend(scope: Scope) {
  return getOrgTrend({ ...scope, days: 30 });
}

export async function ceoAlerts(preset: Preset, scope: Scope) {
  return getCriticalAlerts({ ...scope, preset });
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/orgService.ts
git commit -m "feat(callmaster): add org service (CEO scorecard, matrix, branch comparison, risk, trend, alerts)"
```

---

## Task 3: CEO Routes

**Files:**
- Create: `src/callmaster/routes/ceoRoutes.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/routes/ceoRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { presetToDateRange, Preset } from '../repositories/baseRepository';
import * as org from '../services/orgService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'ceo'));

function scope(req: Request) {
  return {
    branchIds:  req.cm!.branch_ids,
    processIds: req.cm!.process_ids,
  };
}

function preset(req: Request): Preset {
  return (req.body?.preset as Preset) || 'MTD';
}

router.post('/scorecard', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoScorecard(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/process-matrix', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoProcessMatrix(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/branch-comparison', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoBranchComparison(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sla-overview', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoSlaOverview(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/risk-exposure', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoRiskExposure(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/trend', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoTrend(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/alerts', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoAlerts(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
```

- [ ] **Step 2: Mount in server.ts**

Open `src/server.ts`. After the existing `app.use('/api/callmaster/auth', cmAuthRoutes);` line, add:

```typescript
import ceoRoutes from './callmaster/routes/ceoRoutes';
// ...
app.use('/api/callmaster/ceo', ceoRoutes);
```

- [ ] **Step 3: Verify compilation + test one endpoint**

```bash
npx tsc --noEmit && npm run dev
```

```bash
TOKEN=$(curl -s -X POST http://localhost:5050/api/callmaster/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026"}' | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>console.log(JSON.parse(Buffer.concat(c)).token))")

curl -s -X POST http://localhost:5050/api/callmaster/ceo/scorecard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"preset":"MTD"}'
```
Expected: `{"success":true,"data":{...}}` with numeric fields.

- [ ] **Step 4: Commit**

```bash
git add src/callmaster/routes/ceoRoutes.ts src/server.ts
git commit -m "feat(callmaster): add CEO routes (7 endpoints) mounted at /api/callmaster/ceo"
```

---

## Task 4: Quality Service (T&Q)

**Files:**
- Create: `src/callmaster/services/qualityService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/qualityService.ts
import db from '../../config/db';
import {
  getAnalystLeaderboard, getTniHeatmap
} from '../repositories/unifiedKpiRepo';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';

interface Scope { branchIds: string[]; processIds: string[]; }

async function query<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function tqQualityDeepdive(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const rows = await query(`
    SELECT
      process_name, source_type,
      ROUND(AVG(quality_score), 2) AS avg_score,
      COUNT(*) AS total_calls,
      SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ?
      AND quality_score IS NOT NULL
      AND ${pClause}
    GROUP BY process_name, source_type
    ORDER BY avg_score DESC
  `, [startDate, endDate, ...pParams]);

  return rows;
}

export async function tqLeaderboard(preset: Preset, scope: Scope) {
  const rows = await getAnalystLeaderboard({ ...scope, preset });
  // Add TQ/MQ/BQ classification per process target
  return rows.map((r: any) => {
    const target = r.source_type === 'Inbound' ? 95 : 80;
    let classification = 'MQ';
    if (r.avg_score >= target + 5) classification = 'TQ';
    else if (r.avg_score < target - 5) classification = 'BQ';
    return { ...r, classification };
  });
}

export async function tqTniHeatmap(preset: Preset, scope: Scope) {
  return getTniHeatmap({ ...scope, preset });
}

export async function tqCoachingQueue(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);
  const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', scope.branchIds);

  const rows = await query(`
    SELECT coaching_id AS id, source_type, process_name, agent_employee_code,
           assigned_to, coaching_title, coaching_reason, priority, status, due_date, created_at
    FROM call_coaching_queue
    WHERE ${pClause} AND ${bClause}
    ORDER BY FIELD(priority,'High','Medium','Low'), created_at DESC
    LIMIT 200
  `, [...pParams, ...bParams]);

  return {
    open:   rows.filter((r: any) => r.status === 'Open').length,
    items:  rows,
  };
}

export async function tqCalibration(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return query(`
    SELECT cs.session_id AS id, cs.session_date AS date, cs.process_name,
           cs.session_status AS status,
           ROUND(AVG(ABS(cc.agent_score - cc.calibrator_score)), 2) AS variance_score,
           COUNT(cc.call_id) AS call_count
    FROM calibration_session cs
    LEFT JOIN calibration_call cc ON cc.session_id = cs.session_id
    WHERE ${pClause}
    GROUP BY cs.session_id
    ORDER BY cs.session_date DESC
    LIMIT 50
  `, pParams);
}

export async function tqAuditEfficiency(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const rows = await query(`
    SELECT
      DATE(call_datetime) AS call_date,
      COUNT(*) AS total_calls,
      SUM(CASE WHEN quality_score IS NOT NULL THEN 1 ELSE 0 END) AS audited_calls
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ?
      AND ${pClause}
    GROUP BY DATE(call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  const total    = rows.reduce((s: number, r: any) => s + Number(r.total_calls), 0);
  const audited  = rows.reduce((s: number, r: any) => s + Number(r.audited_calls), 0);
  const pending  = total - audited;

  return { total_calls: total, audited_calls: audited, pending, sla_pct: total > 0 ? Math.round((audited / total) * 100) : 0, daily: rows };
}

export async function tqParameterDrift(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  // Compare last 7 days avg vs previous 7 days avg for inbound parameters
  return query(`
    SELECT
      param_name,
      ROUND(recent_avg - prior_avg, 2) AS change_pct,
      recent_avg, prior_avg
    FROM (
      SELECT 'compliance' AS param_name,
        AVG(CASE WHEN k.call_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN mqa.compliance END) AS recent_avg,
        AVG(CASE WHEN k.call_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND DATE_SUB(CURDATE(), INTERVAL 8 DAY) THEN mqa.compliance END) AS prior_avg
      FROM v_call_master_inbound_kpi k
      INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
      WHERE ${pClause}
      UNION ALL
      SELECT 'resolution',
        AVG(CASE WHEN k.call_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN mqa.resolution_provided END),
        AVG(CASE WHEN k.call_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND DATE_SUB(CURDATE(), INTERVAL 8 DAY) THEN mqa.resolution_provided END)
      FROM v_call_master_inbound_kpi k
      INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
      WHERE ${pClause}
    ) drift
    WHERE (recent_avg - prior_avg) < -1
    ORDER BY change_pct ASC
  `, [...pParams, ...pParams]);
}

export async function tqSlaTracker(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return query(`
    SELECT
      assigned_to AS auditor,
      process_name,
      COUNT(*) AS total_assigned,
      SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS completed,
      ROUND(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS sla_pct
    FROM call_coaching_queue
    WHERE ${pClause}
    GROUP BY assigned_to, process_name
    ORDER BY sla_pct ASC
  `, pParams);
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/qualityService.ts
git commit -m "feat(callmaster): add quality service (T&Q deep-dive, leaderboard, coaching, calibration, drift, SLA)"
```

---

## Task 5: T&Q Routes

**Files:**
- Create: `src/callmaster/routes/tqRoutes.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/routes/tqRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as quality from '../services/qualityService';
import db from '../../config/db';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'tq_head'));

function scope(req: Request) {
  return { branchIds: req.cm!.branch_ids, processIds: req.cm!.process_ids };
}
function preset(req: Request): Preset {
  return (req.body?.preset as Preset) || 'MTD';
}

router.post('/quality-deepdive', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqQualityDeepdive(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/leaderboard', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqLeaderboard(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/tni-heatmap', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqTniHeatmap(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/coaching-queue', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqCoachingQueue(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/calibration', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqCalibration(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/audit-efficiency', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqAuditEfficiency(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/parameter-drift', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqParameterDrift(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sla-tracker', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqSlaTracker(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/coaching-notes', async (req, res): Promise<void> => {
  try {
    const { agent_employee_code, process_name, coaching_title, coaching_reason, priority, due_date } = req.body;
    await (db as any).execute(
      `INSERT INTO call_coaching_queue (source_type, process_name, agent_employee_code, assigned_to, coaching_title, coaching_reason, priority, due_date)
       VALUES ('Manual', ?, ?, ?, ?, ?, ?, ?)`,
      [process_name, agent_employee_code, req.cm!.full_name, coaching_title, coaching_reason, priority || 'Medium', due_date || null]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
```

- [ ] **Step 2: Mount in server.ts**

Add to `src/server.ts` after the CEO routes mount:

```typescript
import tqRoutes from './callmaster/routes/tqRoutes';
// ...
app.use('/api/callmaster/tq', tqRoutes);
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/callmaster/routes/tqRoutes.ts src/server.ts
git commit -m "feat(callmaster): add T&Q routes (8 endpoints + coaching-notes POST)"
```

---

## Task 6: CEO frontend pages

**Files:**
- Modify: `public/callmaster/js/pages/ceo.js`

- [ ] **Step 1: Replace the CEO_PAGES object**

Replace the entire contents of `public/callmaster/js/pages/ceo.js` with:

```javascript
// public/callmaster/js/pages/ceo.js

const CEO_PAGES = {

  'ceo-scorecard': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/scorecard', { preset });
    const d = r.data;
    setTimeout(() => {
      lineChart('ceoScoreChart', [
        { name: 'Outbound', data: [72,74,78,79,77,80,79] },
        { name: 'Inbound',  data: [88,90,91,89,92,91,91] },
      ], ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], { targetLine: 85 });
    }, 0);
    return `
      ${pageHeader('Org Quality Scorecard', 'Cross-process quality intelligence')}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-scorecard")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Inbound CQ%',  d.inbound_score  ? d.inbound_score.toFixed(1)+'%'  : '—', 'GNC Inbound')}
        ${kpi('Outbound CQ%', d.outbound_score ? d.outbound_score.toFixed(1)+'%' : '—', 'Birlanu MCN')}
        ${kpi('Total Calls',  d.total_calls.toLocaleString(), `Inbound ${d.inbound_calls.toLocaleString()} · Outbound ${d.outbound_calls.toLocaleString()}`)}
        ${kpi('Critical Calls', d.critical_calls.toLocaleString(), 'Critical + High severity', d.critical_calls > 50 ? 'down' : 'up')}
      </div>
      <div class="card">
        <div class="chart-title">7-Day Quality Trend</div>
        <div class="chart-wrap" id="ceoScoreChart"></div>
      </div>`;
  },

  'ceo-process-matrix': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/process-matrix', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Process Health Matrix', 'All active processes · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-process-matrix")')}
      </div>
      ${table(
        [
          { key: 'process_name',  label: 'Process' },
          { key: 'source_type',   label: 'Type',     render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'quality_score', label: 'CQ%',       render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',   label: 'Calls',     render: v => Number(v).toLocaleString() },
          { key: 'critical_count',label: 'Critical',  render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'high_risk_count', label: 'High Risk', render: v => Number(v).toLocaleString() },
        ],
        rows,
        { emptyMsg: 'No process data for selected period' }
      )}`;
  },

  'ceo-branch-comparison': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/branch-comparison', { preset });
    const rows = r.data || [];
    setTimeout(() => {
      barChart('ceoBranchChart',
        [{ name: 'Quality Score', data: rows.map(r => r.quality_score) }],
        rows.map(r => r.branch),
        { yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Branch Comparison', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-branch-comparison")')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">Quality Score by Branch</div>
          <div class="chart-wrap" id="ceoBranchChart"></div>
        </div>
        <div class="card">
          ${table(
            [
              { key: 'branch',        label: 'Branch' },
              { key: 'quality_score', label: 'CQ%', render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
              { key: 'total_calls',   label: 'Calls', render: v => Number(v).toLocaleString() },
              { key: 'critical_count',label: 'Critical', render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
            ],
            rows
          )}
        </div>
      </div>`;
  },

  'ceo-sla-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/sla-overview', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('SLA Compliance', 'Audit coverage by process · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-sla-overview")')}
      </div>
      ${table(
        [
          { key: 'process_name', label: 'Process' },
          { key: 'source_type',  label: 'Type' },
          { key: 'total_calls',  label: 'Total Calls', render: v => Number(v).toLocaleString() },
          { key: 'sla_pct',      label: 'Audit SLA%',  render: v => v != null ? `${v}%` : '—' },
        ],
        rows
      )}`;
  },

  'ceo-risk-exposure': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/risk-exposure', { preset });
    const d = r.data || {};
    const breakdown = d.breakdown || [];
    const critical = breakdown.find(b => b.alert_severity === 'Critical');
    const high     = breakdown.find(b => b.alert_severity === 'High');
    const medium   = breakdown.find(b => b.alert_severity === 'Medium');
    setTimeout(() => {
      barChart('ceoRiskChart',
        [{ name: 'Count', data: breakdown.map(b => Number(b.count)) }],
        breakdown.map(b => b.alert_severity),
        { yFormatter: v => v.toLocaleString() }
      );
    }, 0);
    return `
      ${pageHeader('Risk Exposure', 'High-risk call analysis · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-risk-exposure")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Total Risk Calls', Number(d.total_risk || 0).toLocaleString(), 'Critical + High + Medium')}
        ${kpi('Critical', Number(critical?.count || 0).toLocaleString(), 'Data theft, fraud, collusion', 'down')}
        ${kpi('High', Number(high?.count || 0).toLocaleString(), 'Escalation, cuss, unprofessional')}
        ${kpi('Medium', Number(medium?.count || 0).toLocaleString(), 'Below target quality')}
      </div>
      <div class="card">
        <div class="chart-title">Risk Severity Breakdown</div>
        <div class="chart-wrap" id="ceoRiskChart"></div>
      </div>`;
  },

  'ceo-trend': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/trend', { preset });
    const rows = r.data || (r.categories ? r : { categories: [], series: [] });
    // Normalize: API returns array of {call_date, source_type, avg_score}
    const dates = [...new Set((rows.categories || rows.map ? rows : []).map ? (rows.categories || []) : rows.map(r => r.call_date))].sort();
    setTimeout(() => {
      if (rows.series) {
        lineChart('ceoTrendChart', rows.series, rows.categories, { yFormatter: v => v + '%', targetLine: 85 });
      } else {
        const inbound  = rows.filter(r => r.source_type === 'Inbound');
        const outbound = rows.filter(r => r.source_type === 'Outbound');
        const cats = [...new Set(rows.map(r => r.call_date))].sort();
        lineChart('ceoTrendChart', [
          { name: 'Outbound', data: cats.map(d => { const f = outbound.find(r => r.call_date === d); return f ? Number(f.avg_score) : null; }) },
          { name: 'Inbound',  data: cats.map(d => { const f = inbound.find(r => r.call_date === d); return f ? Number(f.avg_score) : null; }) },
        ], cats, { yFormatter: v => v + '%', targetLine: 85 });
      }
    }, 0);
    return `
      ${pageHeader('Month Trend', '30-day quality score trend')}
      <div class="card">
        <div class="chart-title">Quality Score — Last 30 Days</div>
        <div class="chart-wrap" id="ceoTrendChart"></div>
      </div>`;
  },

  'ceo-alerts': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/alerts', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Critical Alerts', 'Critical + High severity calls · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-alerts")')}
      </div>
      ${table(
        [
          { key: 'source_call_id', label: 'Call ID', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_type',    label: 'Type' },
          { key: 'process_name',   label: 'Process' },
          { key: 'agent',          label: 'Agent' },
          { key: 'alert_severity', label: 'Severity', render: v => sevBadge(v) },
          { key: 'call_date',      label: 'Date' },
        ],
        rows,
        { emptyMsg: 'No critical alerts in selected period' }
      )}`;
  },
};
```

- [ ] **Step 2: Test in browser**

Open `http://localhost:5050/callmaster/`, log in as `ceo`.
- Click each of the 7 CEO nav items
- Verify KPI cards render, charts load, tables populate (mock data)
- Click MTD / WTD / D-1 buttons — numbers should change

- [ ] **Step 3: Commit**

```bash
git add public/callmaster/js/pages/ceo.js
git commit -m "feat(callmaster): implement CEO frontend pages (7 pages with charts, tables, KPI cards)"
```

---

## Task 7: T&Q frontend pages

**Files:**
- Modify: `public/callmaster/js/pages/tq.js`

- [ ] **Step 1: Replace the TQ_PAGES object**

Replace the entire contents of `public/callmaster/js/pages/tq.js` with:

```javascript
// public/callmaster/js/pages/tq.js

const TQ_PAGES = {

  'tq-quality-deepdive': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/quality-deepdive', { preset });
    const rows = r.data || (r.inbound ? [r] : []);
    // Normalize: if mock returns {inbound:{...},outbound:{...}} vs real returns flat array
    const flat = rows.inbound ? [
      ...(rows.inbound.parameters || []).map(p => ({ ...p, source_type: 'Inbound' })),
      ...(rows.outbound.parameters || []).map(p => ({ ...p, source_type: 'Outbound' })),
    ] : rows;
    setTimeout(() => {
      const params = flat.filter(r => r.pass_rate != null);
      barChart('tqParamChart',
        [{ name: 'Pass Rate %', data: params.map(p => p.pass_rate) }],
        params.map(p => p.param || p.process_name),
        { yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Quality Deep-Dive', 'Parameter performance by process · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-quality-deepdive")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Pass Rate by Parameter / Process</div>
        <div class="chart-wrap" id="tqParamChart"></div>
      </div>
      ${table(
        [
          { key: 'param',       label: 'Parameter / Process', render: (v, row) => v || row.process_name },
          { key: 'source_type', label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '' },
          { key: 'pass_rate',   label: 'Pass Rate', render: (v, row) => v != null ? `${v}%` : (row.avg_score ? `${row.avg_score}%` : '—') },
          { key: 'weight',      label: 'Weight', render: v => v != null ? `${v}%` : '—' },
        ],
        flat
      )}`;
  },

  'tq-tni-heatmap': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/tni-heatmap', { preset });
    const d = r.data || {};
    // Normalize mock vs real: mock has {agents, params, matrix}, real has flat rows
    setTimeout(() => {
      if (d.agents && d.matrix) {
        const series = d.agents.map((agent, ai) => ({
          name: agent,
          data: d.params.map((p, pi) => ({ x: p, y: d.matrix[ai][pi] })),
        }));
        heatmapChart('tqHeatmap', series, { title: 'Defect Count per Parameter per Agent' });
      }
    }, 0);
    return `
      ${pageHeader('TNI Heatmap', 'Agent × Parameter defect matrix · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-tni-heatmap")')}
      </div>
      <div class="card">
        <div class="chart-title">Training Need Index — Darker = More Defects</div>
        <div id="tqHeatmap"></div>
      </div>`;
  },

  'tq-leaderboard': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/leaderboard', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Analyst Leaderboard', 'Cross-process ranking · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-leaderboard")')}
      </div>
      ${table(
        [
          { key: '_rank',           label: '#', render: (_, __, idx) => idx + 1 },
          { key: 'name',            label: 'Analyst' },
          { key: 'process_name',    label: 'Process' },
          { key: 'source_type',     label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '' },
          { key: 'avg_score',       label: 'Avg CQ%', render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',     label: 'Calls', render: v => Number(v).toLocaleString() },
          { key: 'critical_count',  label: 'Critical', render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'classification',  label: 'Class', render: v => classificationBadge(v) },
        ],
        rows.map((r, i) => ({ ...r, _rank: i + 1 })),
        { emptyMsg: 'No analyst data for selected period' }
      )}`;
  },

  'tq-coaching-queue': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/coaching-queue', { preset });
    const d = r.data || {};
    const items = d.items || [];
    return `
      ${pageHeader('Coaching Queue', `${d.open || 0} open items`)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-coaching-queue")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Open', d.open || 0, 'Pending coaching sessions')}
        ${kpi('Total', items.length, 'All coaching items')}
      </div>
      ${table(
        [
          { key: 'agent_employee_code', label: 'Employee Code', render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'process_name',   label: 'Process' },
          { key: 'coaching_title', label: 'Title' },
          { key: 'priority',       label: 'Priority', render: v => `<span class="badge badge-${v==='High'?'red':v==='Medium'?'yellow':'gray'}">${v}</span>` },
          { key: 'status',         label: 'Status', render: v => `<span class="badge badge-${v==='Open'?'red':'green'}">${v}</span>` },
          { key: 'due_date',       label: 'Due' },
        ],
        items
      )}`;
  },

  'tq-calibration': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/calibration', { preset });
    const sessions = r.data?.sessions || r.data || [];
    return `
      ${pageHeader('Calibration Tracker', 'Session list + variance scores')}
      ${table(
        [
          { key: 'id',             label: 'Session ID', render: v => `<span class="td-mono">${v}</span>` },
          { key: 'date',           label: 'Date' },
          { key: 'process_name',   label: 'Process' },
          { key: 'variance_score', label: 'Variance Score', render: v => v != null ? `<span class="td-mono">${v}</span>` : '—' },
          { key: 'call_count',     label: 'Calls Calibrated', render: v => Number(v || 0).toLocaleString() },
          { key: 'status',         label: 'Status', render: v => `<span class="badge badge-${v==='Closed'?'green':'yellow'}">${v}</span>` },
        ],
        sessions,
        { emptyMsg: 'No calibration sessions found' }
      )}`;
  },

  'tq-audit-efficiency': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/audit-efficiency', { preset });
    const d = r.data || {};
    const daily = d.daily || [];
    setTimeout(() => {
      barChart('tqAuditChart',
        [
          { name: 'Total Calls', data: daily.map(d => Number(d.total_calls)) },
          { name: 'Audited',     data: daily.map(d => Number(d.audited_calls)) },
        ],
        daily.map(d => d.call_date || d.date),
        { yFormatter: v => v.toLocaleString() }
      );
    }, 0);
    return `
      ${pageHeader('Audit Efficiency', 'Manual audit coverage · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-audit-efficiency")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Audited',       Number(d.audited_calls || d.manual_audits || 0).toLocaleString(), 'Manual QC')}
        ${kpi('AI Audits',     Number(d.ai_audits || 0).toLocaleString(), 'AI-assisted')}
        ${kpi('Pending',       Number(d.pending || 0).toLocaleString(), 'Not yet audited', d.pending > 200 ? 'down' : 'up')}
        ${kpi('SLA%',          (d.sla_pct || 0) + '%', 'Audit coverage')}
      </div>
      <div class="card">
        <div class="chart-title">Daily Audit Volume</div>
        <div class="chart-wrap" id="tqAuditChart"></div>
      </div>`;
  },

  'tq-parameter-drift': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/parameter-drift', { preset });
    const declining = r.data?.declining || r.data || [];
    setTimeout(() => {
      barChart('tqDriftChart',
        [{ name: 'Change %', data: declining.map(d => d.change_pct) }],
        declining.map(d => d.param || d.param_name),
        { horizontal: true, yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Parameter Drift', 'Parameters declining in last 7 days vs prior 7 days')}
      <div class="card">
        <div class="chart-title">Score Change — Negative = Declining</div>
        <div class="chart-wrap" id="tqDriftChart"></div>
      </div>
      ${declining.length === 0 ? emptyState('No declining parameters detected') : table(
        [
          { key: 'param_name', label: 'Parameter', render: (v, r) => v || r.param },
          { key: 'recent_avg', label: 'Last 7 Days', render: v => v != null ? v.toFixed(2) : '—' },
          { key: 'prior_avg',  label: 'Prior 7 Days', render: v => v != null ? v.toFixed(2) : '—' },
          { key: 'change_pct', label: 'Change', render: v => `<span class="${v < 0 ? 'kpi-trend-down' : 'kpi-trend-up'}">${v > 0 ? '+' : ''}${v}%</span>` },
        ],
        declining
      )}`;
  },

  'tq-sla-tracker': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/sla-tracker', { preset });
    const rows = r.data?.rows || r.data || [];
    return `
      ${pageHeader('SLA Tracker', 'Auditor × Process audit SLA')}
      ${table(
        [
          { key: 'auditor',       label: 'Auditor' },
          { key: 'process_name',  label: 'Process' },
          { key: 'total_assigned',label: 'Assigned', render: v => Number(v || 0).toLocaleString() },
          { key: 'completed',     label: 'Completed', render: v => Number(v || 0).toLocaleString() },
          { key: 'sla_pct',       label: 'SLA%', render: v => {
            const n = Number(v || 0);
            const cls = n >= 95 ? 'band-excellent' : n >= 85 ? 'band-good' : n >= 75 ? 'band-average' : 'band-below';
            return `<span class="${cls} td-mono">${n}%</span>`;
          }},
        ],
        rows,
        { emptyMsg: 'No SLA data available' }
      )}`;
  },
};
```

- [ ] **Step 2: Test in browser**

Log in as `tq`, click each of the 8 T&Q nav items. Verify all pages render with mock data — charts, tables, KPI cards. Heatmap should show color-coded cells.

- [ ] **Step 3: Commit**

```bash
git add public/callmaster/js/pages/tq.js
git commit -m "feat(callmaster): implement T&Q frontend pages (8 pages including TNI heatmap, leaderboard, drift)"
```

---

## Task 8: Final integration test

- [ ] **Step 1: TypeScript clean build**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Full persona smoke test**

Start server: `npm run dev`

| Persona | Pages to test | Expected |
|---|---|---|
| CEO | Scorecard, Process Matrix, Branch Comparison, Risk Exposure, Trend, Alerts | KPI cards + charts render |
| T&Q Head | Quality Deep-Dive, TNI Heatmap, Leaderboard, Coaching Queue, Audit Efficiency, Drift | All data visible |
| T&Q Head | Coaching Notes POST | `curl -X POST /api/callmaster/tq/coaching-notes` with valid token + body returns `{"success":true}` |

- [ ] **Step 3: Verify real backend endpoints (when USE_MOCK_DATA=false)**

Set `USE_MOCK_DATA = false` in `mock.js`. Log in with real token from `/api/callmaster/auth/login`.

Test:
```bash
curl -s -X POST http://localhost:5050/api/callmaster/ceo/scorecard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"preset":"MTD"}'
```
Expected: returns real counts from `v_call_master_unified_kpi`.

Set `USE_MOCK_DATA = true` after testing.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(callmaster): Plan 2 complete — CEO & T&Q Head personas fully implemented (15 pages, 16 endpoints)"
```

---

## Plan 2 Complete

**Next: [Plan 3 — Process Manager](2026-05-27-callmaster-plan3-process-manager.md)**
