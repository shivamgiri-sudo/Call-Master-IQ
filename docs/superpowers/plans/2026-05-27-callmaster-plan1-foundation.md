# Call Master Dashboard — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete backend + frontend skeleton for the Call Master dashboard: DB table, JWT auth, ProcessRegistry, static file serving, login UI, role-based nav shell, and a fully wired mock data layer covering all 40+ endpoints.

**Architecture:** New `src/callmaster/` module added to the existing Express 5 TypeScript backend — no changes to existing routes. The frontend is a single `public/callmaster/index.html` shell with vanilla JS modules. All API calls go through a central `CALLMASTER_API` client that reads `USE_MOCK_DATA` and either returns mock fixtures or hits real endpoints. Plans 2–4 add persona content on top of this shell — they cannot start until this plan is complete.

**Tech Stack:** TypeScript, Express 5, mysql2, bcryptjs, jsonwebtoken (all already in package.json). Frontend: vanilla JS, ApexCharts CDN, Inter + JetBrains Mono from Google Fonts.

---

## File Map

### Backend — new files
```
src/callmaster/
  config/processRegistry.ts      ← source_type + db pool + parameter list per process_name
  middleware/cmAuth.ts            ← JWT verify + role guard + scope injection on req.cm
  repositories/baseRepository.ts ← date-range SQL builder, pagination helpers
  routes/cmAuthRoutes.ts          ← POST /login, GET /me
  services/adminService.ts        ← createUser, getUsers (used only in Plan 4, stub here)
```

### Backend — modified files
```
src/server.ts                     ← mount static files + /api/callmaster routes
```

### Frontend — new files
```
public/callmaster/
  index.html                      ← shell: login overlay, sidebar, topbar, #pageContent
  css/design-system.css           ← OLED dark theme, all component styles
  js/
    app.js                        ← router, JWT decode, CALLMASTER_API, go(), onLogin()
    mock.js                       ← USE_MOCK_DATA toggle + mock data factories for all endpoints
    shared/
      components.js               ← kpi(), table(), drawer(), emptyState(), skeleton(), toast()
      charts.js                   ← ApexCharts wrappers: lineChart(), barChart(), donutChart(), funnelChart(), heatmapChart(), gaugeChart()
    pages/
      ceo.js                      ← stub: "CEO pages coming in Plan 2"
      tq.js                       ← stub: "T&Q pages coming in Plan 2"
      bm.js                       ← stub: "Branch Manager pages coming in Plan 4"
      pm.js                       ← stub: "Process Manager pages coming in Plan 3"
      analyst.js                  ← stub: "Analyst pages coming in Plan 4"
      admin.js                    ← stub: "Admin pages coming in Plan 4"
```

### SQL — new file
```
src/callmaster/config/cm_users.sql  ← CREATE TABLE cm_users + seed admin user
```

---

## Task 1: Create `cm_users` table and seed admin

**Files:**
- Create: `src/callmaster/config/cm_users.sql`

- [ ] **Step 1: Write the SQL file**

```sql
-- Run in MySQL Workbench against Shivamgiri database
CREATE TABLE IF NOT EXISTS cm_users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  role          ENUM('admin','ceo','tq_head','branch_manager','process_manager','analyst') NOT NULL,
  branch_ids    JSON,
  process_ids   JSON,
  employee_code VARCHAR(100),
  active        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin user (password: Admin@2026)
-- Generate hash separately with: node -e "const b=require('bcryptjs');b.hash('Admin@2026',10).then(h=>console.log(h))"
-- Then replace the hash below
INSERT INTO cm_users (username, password_hash, full_name, role, branch_ids, process_ids)
VALUES (
  'admin',
  '$2a$10$REPLACE_WITH_GENERATED_HASH',
  'System Administrator',
  'admin',
  JSON_ARRAY('*'),
  JSON_ARRAY('*')
)
ON DUPLICATE KEY UPDATE username = username;
```

- [ ] **Step 2: Generate bcrypt hash for seed password**

Run in project root:
```bash
node -e "const b=require('bcryptjs');b.hash('Admin@2026',10).then(h=>console.log(h))"
```
Copy the output (starts with `$2a$10$...`) and replace `$2a$10$REPLACE_WITH_GENERATED_HASH` in the SQL file.

- [ ] **Step 3: Run SQL in MySQL Workbench**

Open MySQL Workbench → connect to Shivamgiri → open the SQL file → Execute. Verify:
```sql
SELECT user_id, username, role, active FROM cm_users;
-- Expected: 1 row, role=admin, active=1
```

- [ ] **Step 4: Commit**

```bash
git add src/callmaster/config/cm_users.sql
git commit -m "feat(callmaster): add cm_users table schema and seed admin"
```

---

## Task 2: ProcessRegistry

**Files:**
- Create: `src/callmaster/config/processRegistry.ts`

The ProcessRegistry maps process names to their source type, which DB pool to use for detail queries, and the parameter list for that process type. Inbound parameters come from `manual_qa_audit` columns. Outbound parameters come from `db_external.CallDetails` pitch-related columns.

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/config/processRegistry.ts
import db from '../../config/db';
import dbExternalPool from '../../config/dbExternal';
import dbAuditPool from '../../config/dbAudit';
import { Pool } from 'mysql2/promise';

export type SourceType = 'Inbound' | 'Outbound';

export interface ProcessConfig {
  processName: string;
  sourceType: SourceType;
  pool: Pool;
  targetCqPct: number;  // default quality target for this process
}

// In-memory cache refreshed on first use
let _registry: Map<string, ProcessConfig> | null = null;

export async function getRegistry(): Promise<Map<string, ProcessConfig>> {
  if (_registry) return _registry;

  const [rows] = await (db as any).execute<any[]>(
    `SELECT process_name, source_type, COALESCE(target_cq_pct, 
       CASE WHEN source_type='Inbound' THEN 95 ELSE 80 END) AS target_cq_pct
     FROM process_mapping_master
     WHERE active_status = 1`
  );

  _registry = new Map();
  for (const row of rows) {
    _registry.set(row.process_name, {
      processName: row.process_name,
      sourceType: row.source_type as SourceType,
      pool: row.source_type === 'Inbound' ? (dbAuditPool as unknown as Pool) : (dbExternalPool as unknown as Pool),
      targetCqPct: Number(row.target_cq_pct),
    });
  }
  return _registry;
}

export function clearRegistryCache(): void {
  _registry = null;
}

export async function getProcessConfig(processName: string): Promise<ProcessConfig | undefined> {
  const reg = await getRegistry();
  return reg.get(processName);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/config/processRegistry.ts
git commit -m "feat(callmaster): add ProcessRegistry for process→sourceType→pool mapping"
```

---

## Task 3: Base Repository helpers

**Files:**
- Create: `src/callmaster/repositories/baseRepository.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/repositories/baseRepository.ts

export type Preset = 'MTD' | 'WTD' | 'D1';

export interface DateRange {
  startDate: string;  // 'YYYY-MM-DD'
  endDate: string;
}

export function presetToDateRange(preset: Preset): DateRange {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const today = fmt(now);

  if (preset === 'D1') {
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 1);
    const d1s = fmt(d1);
    return { startDate: d1s, endDate: d1s };
  }

  if (preset === 'WTD') {
    const dayOfWeek = now.getDay(); // 0=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return { startDate: fmt(monday), endDate: today };
  }

  // MTD
  return {
    startDate: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`,
    endDate: today,
  };
}

export interface PaginationParams {
  page: number;   // 1-indexed
  limit: number;
}

export function paginationClause(p: PaginationParams): string {
  const offset = (p.page - 1) * p.limit;
  return `LIMIT ${p.limit} OFFSET ${offset}`;
}

export function safeScopeFilter(
  field: string,
  values: string[]
): { clause: string; params: string[] } {
  if (values.includes('*') || values.length === 0) {
    return { clause: '1=1', params: [] };
  }
  const placeholders = values.map(() => '?').join(',');
  return { clause: `${field} IN (${placeholders})`, params: values };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/repositories/baseRepository.ts
git commit -m "feat(callmaster): add base repository helpers (preset→dateRange, pagination, scope filter)"
```

---

## Task 4: Call Master JWT middleware

**Files:**
- Create: `src/callmaster/middleware/cmAuth.ts`

This middleware is separate from the existing `src/middleware/auth.ts` — it uses `cm_users` instead of `user_master` and injects `req.cm` with the decoded token payload.

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/middleware/cmAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface CmUser {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'ceo' | 'tq_head' | 'branch_manager' | 'process_manager' | 'analyst';
  branch_ids: string[];
  process_ids: string[];
  employee_code: string | null;
}

declare global {
  namespace Express {
    interface Request {
      cm?: CmUser;
    }
  }
}

export function cmAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as CmUser & { iat: number; exp: number };
    req.cm = {
      user_id: payload.user_id,
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role,
      branch_ids: payload.branch_ids,
      process_ids: payload.process_ids,
      employee_code: payload.employee_code,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: CmUser['role'][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.cm || !roles.includes(req.cm.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/middleware/cmAuth.ts
git commit -m "feat(callmaster): add cmAuth middleware with CmUser type and requireRole guard"
```

---

## Task 5: Auth routes (login + me)

**Files:**
- Create: `src/callmaster/routes/cmAuthRoutes.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/routes/cmAuthRoutes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/db';
import { cmAuthMiddleware, CmUser } from '../middleware/cmAuth';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'username and password required' });
    return;
  }

  try {
    const [rows] = await (db as any).execute<any[]>(
      `SELECT user_id, username, password_hash, full_name, role, branch_ids, process_ids, employee_code
       FROM cm_users WHERE username = ? AND active = 1 LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const payload: Omit<CmUser, never> = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      branch_ids: typeof user.branch_ids === 'string' ? JSON.parse(user.branch_ids) : user.branch_ids,
      process_ids: typeof user.process_ids === 'string' ? JSON.parse(user.process_ids) : user.process_ids,
      employee_code: user.employee_code,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '12h' });
    res.json({ success: true, token, user: payload });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', cmAuthMiddleware, (req: Request, res: Response): void => {
  res.json({ success: true, user: req.cm });
});

export default router;
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/routes/cmAuthRoutes.ts
git commit -m "feat(callmaster): add auth routes (POST /login, GET /me)"
```

---

## Task 6: Mount Call Master routes in server.ts + serve static files

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add imports and mounts to server.ts**

Open `src/server.ts`. After the existing imports, add:

```typescript
import path from 'path';
import cmAuthRoutes from './callmaster/routes/cmAuthRoutes';
```

After the existing `app.use('/api/careers', careersRoutes);` line, add:

```typescript
// Call Master Dashboard
app.use('/api/callmaster/auth', cmAuthRoutes);

// Serve Call Master frontend static files
app.use('/callmaster', express.static(path.join(__dirname, '..', 'public', 'callmaster')));
```

The full addition block:
```typescript
// Call Master Dashboard
app.use('/api/callmaster/auth', cmAuthRoutes);
app.use('/callmaster', express.static(path.join(__dirname, '..', 'public', 'callmaster')));
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Test login endpoint manually**

Start the server:
```bash
npm run dev
```

In another terminal, test login (the admin user must already be seeded from Task 1):
```bash
curl -s -X POST http://localhost:5050/api/callmaster/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026"}' | node -e "process.stdin|>require('stream/consumers').text|>p=>p.then(t=>console.log(JSON.stringify(JSON.parse(t),null,2)))"
```
Expected: `{ "success": true, "token": "eyJ...", "user": { "role": "admin", ... } }`

Test /me with the token from above:
```bash
TOKEN="eyJ..."   # paste token from above
curl -s http://localhost:5050/api/callmaster/auth/me \
  -H "Authorization: Bearer $TOKEN" | node -e "process.stdin|>require('stream/consumers').text|>p=>p.then(t=>console.log(t))"
```
Expected: `{ "success": true, "user": { "role": "admin", ... } }`

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(callmaster): mount auth routes and static file serving at /callmaster"
```

---

## Task 7: Design system CSS

**Files:**
- Create: `public/callmaster/css/design-system.css`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p public/callmaster/css
mkdir -p public/callmaster/js/shared
mkdir -p public/callmaster/js/pages
```

- [ ] **Step 2: Create the CSS file**

```css
/* public/callmaster/css/design-system.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #060a14;
  --surface:   #0d1424;
  --surface2:  #111827;
  --surface3:  #1a2236;
  --border:    rgba(255,255,255,0.07);
  --border2:   rgba(255,255,255,0.12);
  --text:      #e2e8f0;
  --text2:     #94a3b8;
  --text3:     #64748b;
  --primary:   #3b82f6;
  --primary-dim:#1d4ed8;
  --accent:    #06d6a0;
  --gold:      #f59e0b;
  --danger:    #ef4444;
  --warning:   #f97316;
  --success:   #22c55e;
  --violet:    #8b5cf6;
  --teal:      #14b8a6;
  --sidebar-w: 220px;
  --topbar-h:  56px;
  --radius:    14px;
  --radius-sm: 8px;
  --shadow:    0 4px 24px rgba(0,0,0,0.4);
}

html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.5; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 4px; }

/* ── Layout ── */
#appShell { display: flex; height: 100vh; overflow: hidden; }
#sidebar { width: var(--sidebar-w); background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; transition: width 0.2s; }
#sidebar.collapsed { width: 56px; }
#mainArea { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
#topbar { height: var(--topbar-h); background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 12px; flex-shrink: 0; }
#pageContent { flex: 1; overflow-y: auto; padding: 20px; }

/* ── Sidebar nav ── */
.nav-logo { padding: 16px 16px 8px; display: flex; align-items: center; gap: 10px; }
.nav-logo .logo-icon { width: 32px; height: 32px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #fff; flex-shrink: 0; }
.nav-logo .logo-text { font-weight: 700; font-size: 15px; color: var(--text); white-space: nowrap; }
.nav-section-label { padding: 12px 16px 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); white-space: nowrap; overflow: hidden; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 16px; cursor: pointer; border-radius: 0; color: var(--text2); font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; transition: background 0.15s, color 0.15s; }
.nav-item:hover { background: var(--surface2); color: var(--text); }
.nav-item.active { background: rgba(59,130,246,0.12); color: var(--primary); }
.nav-item .nav-icon { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.8; }
.nav-item.active .nav-icon { opacity: 1; }

/* ── Topbar ── */
.topbar-title { font-size: 15px; font-weight: 600; flex: 1; }
.persona-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
.badge-admin    { background: rgba(255,255,255,0.08); color: #fff; }
.badge-ceo      { background: rgba(245,158,11,0.15); color: var(--gold); }
.badge-tq_head  { background: rgba(139,92,246,0.15); color: var(--violet); }
.badge-branch_manager { background: rgba(59,130,246,0.15); color: var(--primary); }
.badge-process_manager { background: rgba(20,184,166,0.15); color: var(--teal); }
.badge-analyst  { background: rgba(239,68,68,0.15); color: var(--danger); }
.topbar-user { font-size: 13px; color: var(--text2); }

/* ── Period slicer ── */
.preset-bar { display: flex; gap: 4px; }
.preset-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border2); background: transparent; color: var(--text2); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.preset-btn:hover { border-color: var(--primary); color: var(--text); }
.preset-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; }

/* ── Filter bar ── */
.filter-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filter-select { background: var(--surface2); border: 1px solid var(--border2); color: var(--text); border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.filter-select:focus { outline: none; border-color: var(--primary); }

/* ── Cards ── */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
.card-sm { padding: 14px; }
.card-title { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }

/* ── KPI cards ── */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; }
.kpi-label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.kpi-value { font-size: 28px; font-weight: 700; color: var(--text); font-family: 'JetBrains Mono', monospace; line-height: 1; }
.kpi-sub { font-size: 11px; color: var(--text3); margin-top: 4px; }
.kpi-trend-up   { color: var(--accent); }
.kpi-trend-down { color: var(--danger); }

/* ── Tables ── */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border2); white-space: nowrap; }
tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: var(--surface2); }
tbody td { padding: 10px 14px; color: var(--text); vertical-align: middle; }
.td-mono { font-family: 'JetBrains Mono', monospace; }

/* ── Badges ── */
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.badge-green   { background: rgba(34,197,94,0.12);  color: var(--success); }
.badge-red     { background: rgba(239,68,68,0.12);   color: var(--danger); }
.badge-yellow  { background: rgba(245,158,11,0.12);  color: var(--gold); }
.badge-blue    { background: rgba(59,130,246,0.12);  color: var(--primary); }
.badge-violet  { background: rgba(139,92,246,0.12);  color: var(--violet); }
.badge-gray    { background: rgba(100,116,139,0.12); color: var(--text3); }
.badge-tq      { background: rgba(6,214,160,0.12);   color: var(--accent); }

/* ── Quality band colors ── */
.band-excellent { color: var(--accent); }
.band-good      { color: var(--success); }
.band-average   { color: var(--gold); }
.band-below     { color: var(--danger); }

/* ── Severity ── */
.sev-critical { color: #ff3b30; font-weight: 700; }
.sev-high     { color: var(--danger); }
.sev-medium   { color: var(--gold); }
.sev-normal   { color: var(--text3); }

/* ── Charts ── */
.chart-wrap { min-height: 260px; }
.chart-title { font-size: 13px; font-weight: 600; color: var(--text2); margin-bottom: 12px; }

/* ── Grid layouts ── */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.grid-auto { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
@media (max-width: 900px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

/* ── Skeleton ── */
.skeleton { background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-line { height: 14px; margin-bottom: 8px; border-radius: 4px; }
.skeleton-kpi  { height: 80px; border-radius: var(--radius); }
.skeleton-chart { height: 260px; border-radius: var(--radius); }

/* ── Drawer ── */
#drawerRoot { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
#drawerRoot.open { pointer-events: all; }
.drawer-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; }
#drawerRoot.open .drawer-overlay { opacity: 1; }
.drawer-panel { position: absolute; right: 0; top: 0; bottom: 0; width: min(600px, 100vw); background: var(--surface); border-left: 1px solid var(--border); transform: translateX(100%); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); overflow-y: auto; padding: 24px; }
#drawerRoot.open .drawer-panel { transform: translateX(0); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.drawer-title { font-size: 16px; font-weight: 600; }
.drawer-close { background: none; border: none; color: var(--text2); font-size: 22px; cursor: pointer; padding: 4px; line-height: 1; }

/* ── Login overlay ── */
#loginOverlay { position: fixed; inset: 0; background: var(--bg); z-index: 2000; display: flex; align-items: center; justify-content: center; }
#loginOverlay.hidden { display: none; }
.login-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 40px; width: 380px; }
.login-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.login-sub { font-size: 13px; color: var(--text2); margin-bottom: 28px; }
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
.form-input { width: 100%; background: var(--surface2); border: 1px solid var(--border2); color: var(--text); border-radius: 8px; padding: 10px 14px; font-size: 14px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s; }
.form-input:focus { border-color: var(--primary); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border-radius: var(--radius-sm); border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dim); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-full { width: 100%; }
.login-error { color: var(--danger); font-size: 13px; margin-top: 8px; min-height: 18px; }

/* ── Toast ── */
#toastContainer { position: fixed; bottom: 24px; right: 24px; z-index: 3000; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; padding: 12px 18px; font-size: 13px; box-shadow: var(--shadow); animation: slideUp 0.2s ease; max-width: 320px; }
.toast-success { border-left: 3px solid var(--success); }
.toast-error   { border-left: 3px solid var(--danger); }
.toast-info    { border-left: 3px solid var(--primary); }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ── Empty state ── */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text3); gap: 12px; }
.empty-state-icon { font-size: 40px; opacity: 0.4; }
.empty-state-text { font-size: 14px; }

/* ── Page header ── */
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 18px; font-weight: 700; }
.page-sub { font-size: 13px; color: var(--text2); margin-top: 2px; }
```

- [ ] **Step 3: Commit**

```bash
git add public/callmaster/css/design-system.css
git commit -m "feat(callmaster): add OLED dark design system CSS"
```

---

## Task 8: Shared component library (JS)

**Files:**
- Create: `public/callmaster/js/shared/components.js`

- [ ] **Step 1: Create the file**

```javascript
// public/callmaster/js/shared/components.js

// ── KPI card ──
function kpi(label, value, sub = '', trendDir = '') {
  const trendClass = trendDir === 'up' ? 'kpi-trend-up' : trendDir === 'down' ? 'kpi-trend-down' : '';
  return `<div class="kpi-card">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value ${trendClass}">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

// ── Data table ──
// cols: [{key, label, render?}]
// rows: array of objects
function table(cols, rows, { emptyMsg = 'No data', onRowClick } = {}) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">${emptyMsg}</div></div>`;
  }
  const thead = cols.map(c => `<th>${c.label}</th>`).join('');
  const tbody = rows.map(r => {
    const cells = cols.map(c => {
      const val = c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—');
      return `<td>${val}</td>`;
    }).join('');
    const clickAttr = onRowClick ? `style="cursor:pointer" onclick="(${onRowClick.toString()})(${JSON.stringify(r)})"` : '';
    return `<tr ${clickAttr}>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

// ── Quality band badge ──
function bandBadge(band) {
  const map = {
    'Excellent': 'badge badge-green',
    'Good':      'badge badge-tq',
    'Average':   'badge badge-yellow',
    'Below Average': 'badge badge-red',
  };
  return `<span class="${map[band] || 'badge badge-gray'}">${band || '—'}</span>`;
}

// ── Severity badge ──
function sevBadge(sev) {
  const map = {
    'Critical': 'sev-critical',
    'High':     'sev-high',
    'Medium':   'sev-medium',
    'Normal':   'sev-normal',
  };
  return `<span class="${map[sev] || 'sev-normal'}">${sev || 'Normal'}</span>`;
}

// ── TQ/MQ/BQ badge ──
function classificationBadge(cls) {
  const map = { 'TQ': 'badge-tq', 'MQ': 'badge-blue', 'BQ': 'badge-red' };
  return `<span class="badge ${map[cls] || 'badge-gray'}">${cls || '—'}</span>`;
}

// ── Skeleton loaders ──
function skeleton() {
  return `<div class="kpi-grid">
    ${Array(4).fill('<div class="skeleton skeleton-kpi"></div>').join('')}
  </div>
  <div class="skeleton skeleton-chart" style="margin-bottom:16px"></div>
  <div class="skeleton skeleton-chart"></div>`;
}

function skeletonLines(n = 5) {
  return Array(n).fill('<div class="skeleton skeleton-line"></div>').join('');
}

// ── Empty state ──
function emptyState(msg = 'No data available') {
  return `<div class="empty-state">
    <div class="empty-state-icon">📭</div>
    <div class="empty-state-text">${msg}</div>
  </div>`;
}

// ── Toast ──
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Drawer ──
function openDrawer(titleHtml, bodyHtml) {
  const root = document.getElementById('drawerRoot');
  root.querySelector('.drawer-title').innerHTML = titleHtml;
  root.querySelector('.drawer-body').innerHTML = bodyHtml;
  root.classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerRoot').classList.remove('open');
}

// ── Preset bar ──
function presetBar(activePreset, onChangeFn) {
  return `<div class="preset-bar">
    ${['MTD','WTD','D1'].map(p => `<button class="preset-btn${p === activePreset ? ' active' : ''}" data-preset="${p}" onclick="${onChangeFn}('${p}')">${p}</button>`).join('')}
  </div>`;
}

// ── Page header ──
function pageHeader(title, sub = '') {
  return `<div class="page-header">
    <div>
      <div class="page-title">${title}</div>
      ${sub ? `<div class="page-sub">${sub}</div>` : ''}
    </div>
  </div>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/shared/components.js
git commit -m "feat(callmaster): add shared component library (kpi, table, badges, skeleton, toast, drawer)"
```

---

## Task 9: ApexCharts wrapper library

**Files:**
- Create: `public/callmaster/js/shared/charts.js`

- [ ] **Step 1: Create the file**

```javascript
// public/callmaster/js/shared/charts.js
// All functions create/update ApexCharts instances.
// ApexCharts is loaded via CDN in index.html.

const CHART_DEFAULTS = {
  theme: { mode: 'dark' },
  chart: { background: 'transparent', fontFamily: 'Inter, sans-serif', toolbar: { show: false } },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 3 },
  tooltip: { theme: 'dark' },
  colors: ['#3b82f6','#06d6a0','#f59e0b','#ef4444','#8b5cf6','#14b8a6'],
};

function lineChart(elId, series, categories, { title = '', yFormatter = v => v, targetLine = null } = {}) {
  const annotations = targetLine ? {
    yaxis: [{ y: targetLine, borderColor: '#f59e0b', strokeDashArray: 4, label: { text: `Target ${targetLine}%`, style: { color: '#f59e0b', background: 'transparent' } } }]
  } : {};

  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'line', height: 260, id: elId },
    series,
    xaxis: { categories, labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    yaxis: { labels: { formatter: yFormatter, style: { colors: '#64748b' } } },
    stroke: { width: 2, curve: 'smooth' },
    markers: { size: 3 },
    annotations,
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function barChart(elId, series, categories, { title = '', horizontal = false, yFormatter = v => v } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'bar', height: 260, id: elId },
    series,
    plotOptions: { bar: { horizontal, borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories, labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    yaxis: { labels: { formatter: yFormatter, style: { colors: '#64748b' } } },
    dataLabels: { enabled: false },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function donutChart(elId, labels, values, { title = '' } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(values); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'donut', height: 260, id: elId },
    series: values,
    labels,
    legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
    dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function heatmapChart(elId, series, { title = '', yFormatter = v => v } = {}) {
  // series: [{name: 'AgentName', data: [{x: 'Param', y: defectCount},...]}]
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'heatmap', height: Math.max(260, series.length * 28), id: elId },
    series,
    plotOptions: { heatmap: { shadeIntensity: 0.5, colorScale: { ranges: [
      { from: 0, to: 0,  color: '#1a2236', name: 'None' },
      { from: 1, to: 3,  color: '#1d4ed8', name: 'Low' },
      { from: 4, to: 7,  color: '#f59e0b', name: 'Medium' },
      { from: 8, to: 999, color: '#ef4444', name: 'High' },
    ]}}},
    dataLabels: { enabled: true, style: { colors: ['#fff'], fontSize: '10px' } },
    xaxis: { labels: { style: { colors: '#64748b', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' } } },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function funnelChart(elId, labels, values, { title = '', color = '#3b82f6' } = {}) {
  // Rendered as horizontal bar chart sorted descending (ApexCharts has no native funnel)
  const series = [{ name: 'Count', data: values }];
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries(series); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'bar', height: 260, id: elId },
    colors: [color],
    series,
    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true, barHeight: '70%' } },
    xaxis: { categories: labels, labels: { style: { colors: '#64748b' } } },
    yaxis: { labels: { style: { colors: '#94a3b8' } } },
    dataLabels: { enabled: true, style: { colors: ['#fff'] }, formatter: v => v.toLocaleString() },
    legend: { show: false },
    title: title ? { text: title, style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } } : undefined,
  });
  el._apexChart.render();
}

function gaugeChart(elId, value, max, label, { color = '#3b82f6' } = {}) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (el._apexChart) { el._apexChart.updateSeries([value]); return; }

  el._apexChart = new ApexCharts(el, {
    ...CHART_DEFAULTS,
    chart: { ...CHART_DEFAULTS.chart, type: 'radialBar', height: 240, id: elId },
    series: [Math.round((value / max) * 100)],
    colors: [color],
    plotOptions: { radialBar: {
      startAngle: -135, endAngle: 135,
      hollow: { size: '65%' },
      dataLabels: { name: { show: true, color: '#94a3b8', fontSize: '12px', offsetY: 20 }, value: { show: true, fontSize: '28px', fontWeight: 700, color: '#e2e8f0', formatter: () => label } },
    }},
    labels: [label],
  });
  el._apexChart.render();
}

function destroyChart(elId) {
  const el = document.getElementById(elId);
  if (el && el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
}

function destroyAllCharts() {
  document.querySelectorAll('[id]').forEach(el => {
    if (el._apexChart) { el._apexChart.destroy(); el._apexChart = null; }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/shared/charts.js
git commit -m "feat(callmaster): add ApexCharts wrapper library (line, bar, donut, heatmap, funnel, gauge)"
```

---

## Task 10: Page stubs for Plans 2–4

**Files:**
- Create: `public/callmaster/js/pages/ceo.js`
- Create: `public/callmaster/js/pages/tq.js`
- Create: `public/callmaster/js/pages/bm.js`
- Create: `public/callmaster/js/pages/pm.js`
- Create: `public/callmaster/js/pages/analyst.js`
- Create: `public/callmaster/js/pages/admin.js`

- [ ] **Step 1: Create all six stub files**

```javascript
// public/callmaster/js/pages/ceo.js
const CEO_PAGES = {
  'ceo-scorecard':        () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">CEO Scorecard — coming in Plan 2</div></div>`,
  'ceo-process-matrix':   () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Process Matrix — coming in Plan 2</div></div>`,
  'ceo-branch-comparison':() => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Branch Comparison — coming in Plan 2</div></div>`,
  'ceo-sla-overview':     () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">SLA Overview — coming in Plan 2</div></div>`,
  'ceo-risk-exposure':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Risk Exposure — coming in Plan 2</div></div>`,
  'ceo-trend':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Month Trend — coming in Plan 2</div></div>`,
  'ceo-alerts':           () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Critical Alerts — coming in Plan 2</div></div>`,
};
```

```javascript
// public/callmaster/js/pages/tq.js
const TQ_PAGES = {
  'tq-quality-deepdive':  () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Quality Deep-Dive — coming in Plan 2</div></div>`,
  'tq-tni-heatmap':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">TNI Heatmap — coming in Plan 2</div></div>`,
  'tq-leaderboard':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Analyst Leaderboard — coming in Plan 2</div></div>`,
  'tq-coaching-queue':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Coaching Queue — coming in Plan 2</div></div>`,
  'tq-calibration':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Calibration Tracker — coming in Plan 2</div></div>`,
  'tq-audit-efficiency':  () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Audit Efficiency — coming in Plan 2</div></div>`,
  'tq-parameter-drift':   () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Parameter Drift — coming in Plan 2</div></div>`,
  'tq-sla-tracker':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">SLA Tracker — coming in Plan 2</div></div>`,
};
```

```javascript
// public/callmaster/js/pages/pm.js
const PM_PAGES = {
  'pm-overview':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Process Overview — coming in Plan 3</div></div>`,
  'pm-parameters':          () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Parameter Breakdown — coming in Plan 3</div></div>`,
  'pm-explorer':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Call Explorer — coming in Plan 3</div></div>`,
  'pm-analyst-scorecard':   () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Analyst Scorecard — coming in Plan 3</div></div>`,
  'pm-tni':                 () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">TNI Report — coming in Plan 3</div></div>`,
  'pm-trends':              () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Daily Trends — coming in Plan 3</div></div>`,
  'pm-evidence':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Evidence Viewer — coming in Plan 3</div></div>`,
  'pm-defect-analysis':     () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Defect Analysis — coming in Plan 3</div></div>`,
  'pm-fatal-analysis':      () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Fatal Analysis (Inbound) — coming in Plan 3</div></div>`,
  'pm-scenario':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Scenario Breakdown (Inbound) — coming in Plan 3</div></div>`,
  'pm-detail-analysis':     () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Detail Analysis (Inbound) — coming in Plan 3</div></div>`,
  'pm-escalation':          () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Escalation Analysis (Inbound) — coming in Plan 3</div></div>`,
  'pm-cst-crt':             () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">CST/CRT Funnel (Outbound) — coming in Plan 3</div></div>`,
  'pm-missed-opp':          () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Missed Opportunity Analysis (Outbound) — coming in Plan 3</div></div>`,
  'pm-nps-csat':            () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">NPS & CSAT (Outbound) — coming in Plan 3</div></div>`,
  'pm-pitch-stage':         () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Pitch Stage Analysis (Outbound) — coming in Plan 3</div></div>`,
  'pm-objection-rebuttal':  () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Objection Rebuttal (Outbound) — coming in Plan 3</div></div>`,
};
```

```javascript
// public/callmaster/js/pages/bm.js
const BM_PAGES = {
  'bm-health':          () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Branch Health — coming in Plan 4</div></div>`,
  'bm-process-breakdown':() => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Process Breakdown — coming in Plan 4</div></div>`,
  'bm-team-performance':() => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Team Performance — coming in Plan 4</div></div>`,
  'bm-daily-sla':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Daily SLA — coming in Plan 4</div></div>`,
  'bm-risk-calls':      () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Risk Call Feed — coming in Plan 4</div></div>`,
  'bm-action-items':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Action Items — coming in Plan 4</div></div>`,
};
```

```javascript
// public/callmaster/js/pages/analyst.js
const ANALYST_PAGES = {
  'analyst-overview':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">My Score Overview — coming in Plan 4</div></div>`,
  'analyst-defects':     () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">My Defect Breakdown — coming in Plan 4</div></div>`,
  'analyst-calls':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">My Call List — coming in Plan 4</div></div>`,
  'analyst-evidence':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Evidence Review — coming in Plan 4</div></div>`,
  'analyst-trend':       () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Score Trend — coming in Plan 4</div></div>`,
  'analyst-coaching':    () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Coaching Notes — coming in Plan 4</div></div>`,
};
```

```javascript
// public/callmaster/js/pages/admin.js
const ADMIN_PAGES = {
  'admin-users':         () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">User Management — coming in Plan 4</div></div>`,
  'admin-processes':     () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Process Config — coming in Plan 4</div></div>`,
  'admin-data-sources':  () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Data Source Mapping — coming in Plan 4</div></div>`,
  'admin-impersonate':   () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Role Impersonation — coming in Plan 4</div></div>`,
  'admin-health':        () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">System Health — coming in Plan 4</div></div>`,
  'admin-audit-config':  () => `<div class="empty-state"><div class="empty-state-icon">🏗️</div><div class="empty-state-text">Audit Configuration — coming in Plan 4</div></div>`,
};
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/pages/
git commit -m "feat(callmaster): add page stubs for all 6 personas (Plans 2-4 placeholders)"
```

---

## Task 11: Mock data layer

**Files:**
- Create: `public/callmaster/js/mock.js`

- [ ] **Step 1: Create mock.js**

```javascript
// public/callmaster/js/mock.js
const USE_MOCK_DATA = true;

// Scale factor per preset so mock numbers feel realistic
const SCALE = { MTD: 1.0, WTD: 0.27, D1: 0.04 };

function s(base, preset) { return Math.round(base * (SCALE[preset] || 1)); }

// ── Mock data factories ──

function mockCeoScorecard(preset) {
  return {
    outbound_score: 79.4,
    inbound_score: 91.2,
    total_calls: s(84200, preset),
    critical_calls: s(312, preset),
    inbound_calls: s(38500, preset),
    outbound_calls: s(45700, preset),
  };
}

function mockCeoProcessMatrix(preset) {
  return [
    { process_name: 'Birlanu MCN', source_type: 'Outbound', quality_score: 79.4, total_calls: s(45700, preset), sla_pct: 88.2, critical_count: s(200, preset) },
    { process_name: 'GNC Inbound', source_type: 'Inbound',  quality_score: 91.2, total_calls: s(38500, preset), sla_pct: 94.1, critical_count: s(112, preset) },
  ];
}

function mockCeoBranchComparison(preset) {
  return [
    { branch: 'Delhi NCR',   quality_score: 88.1, total_calls: s(28000, preset), critical_count: s(98, preset),  trend: 'up' },
    { branch: 'Mumbai',      quality_score: 85.6, total_calls: s(22000, preset), critical_count: s(114, preset), trend: 'down' },
    { branch: 'Bengaluru',   quality_score: 83.2, total_calls: s(18500, preset), critical_count: s(64, preset),  trend: 'up' },
    { branch: 'Hyderabad',   quality_score: 79.9, total_calls: s(15700, preset), critical_count: s(36, preset),  trend: 'flat' },
  ];
}

function mockCeoTrend() {
  const days = 30;
  const cats = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return `${d.getDate()}/${d.getMonth()+1}`;
  });
  const outbound = Array.from({ length: days }, () => +(75 + Math.random() * 10).toFixed(1));
  const inbound  = Array.from({ length: days }, () => +(88 + Math.random() * 8).toFixed(1));
  return { categories: cats, series: [{ name: 'Outbound', data: outbound }, { name: 'Inbound', data: inbound }] };
}

function mockCeoAlerts(preset) {
  return [
    { call_id: 'IB-2891', source_type: 'Inbound', process_name: 'GNC Inbound', agent: 'Ravi Kumar', severity: 'Critical', reason: 'Data theft detected', call_date: '2026-05-27' },
    { call_id: 'OB-5512', source_type: 'Outbound', process_name: 'Birlanu MCN', agent: 'Priya Mehta', severity: 'High', reason: 'Sensitive word used', call_date: '2026-05-27' },
    { call_id: 'IB-2892', source_type: 'Inbound', process_name: 'GNC Inbound', agent: 'Suresh Rao', severity: 'High', reason: 'Escalation failure', call_date: '2026-05-27' },
  ];
}

function mockTqQualityDeepdive(preset) {
  return {
    inbound: { score: 91.2, parameters: [
      { param: 'Opening', pass_rate: 96.1, weight: 10 },
      { param: 'Compliance', pass_rate: 88.4, weight: 15 },
      { param: 'Resolution', pass_rate: 94.7, weight: 20 },
      { param: 'Call Closure', pass_rate: 91.2, weight: 10 },
    ]},
    outbound: { score: 79.4, parameters: [
      { param: 'Opening Pitch', pass_rate: 82.1, weight: 15 },
      { param: 'Context Setting', pass_rate: 74.3, weight: 15 },
      { param: 'Offer Pitch', pass_rate: 71.8, weight: 20 },
      { param: 'Objection Handling', pass_rate: 68.5, weight: 20 },
    ]},
  };
}

function mockTqLeaderboard(preset) {
  return [
    { employee_code: 'EMP001', name: 'Anita Sharma',  process: 'GNC Inbound',  score: 97.2, calls: s(320, preset), classification: 'TQ' },
    { employee_code: 'EMP002', name: 'Rahul Singh',   process: 'GNC Inbound',  score: 94.1, calls: s(290, preset), classification: 'TQ' },
    { employee_code: 'EMP003', name: 'Deepak Verma',  process: 'Birlanu MCN',  score: 82.4, calls: s(410, preset), classification: 'MQ' },
    { employee_code: 'EMP004', name: 'Sonal Gupta',   process: 'Birlanu MCN',  score: 74.1, calls: s(380, preset), classification: 'BQ' },
    { employee_code: 'EMP005', name: 'Kiran Patil',   process: 'GNC Inbound',  score: 88.9, calls: s(310, preset), classification: 'MQ' },
  ];
}

function mockPmOverview(preset) {
  return {
    quality_score: 91.2, total_calls: s(38500, preset),
    defect_count: s(3400, preset), critical_count: s(112, preset),
    target_cq_pct: 95, source_type: 'Inbound',
  };
}

function mockPmAnalystScorecard(preset) {
  return [
    { employee_code: 'EMP001', name: 'Anita Sharma',  score: 97.2, calls: s(320, preset), fatal_count: 0,  classification: 'TQ' },
    { employee_code: 'EMP002', name: 'Rahul Singh',   score: 94.1, calls: s(290, preset), fatal_count: 1,  classification: 'TQ' },
    { employee_code: 'EMP005', name: 'Kiran Patil',   score: 88.9, calls: s(310, preset), fatal_count: 2,  classification: 'MQ' },
    { employee_code: 'EMP006', name: 'Meera Joshi',   score: 83.4, calls: s(280, preset), fatal_count: 3,  classification: 'BQ' },
  ];
}

function mockPmFatalAnalysis(preset) {
  return {
    fatal_pct: 2.8, without_fatal_cq: 93.6,
    top_contributors: [
      { agent: 'Meera Joshi', fatal_count: 3 },
      { agent: 'Rahul Singh', fatal_count: 1 },
    ],
    day_wise: { categories: ['Mon','Tue','Wed','Thu','Fri'], fatal_pct: [3.1, 2.4, 2.9, 2.2, 3.8] },
    scenario_fatal: {
      scenarios: ['Query','Complaint','Request','Sale Done'],
      fatal_types: ['Data Theft','Financial Fraud','Escalation Failure','Unprofessional'],
      matrix: [[1,0,2,0],[3,1,0,1],[0,0,1,0],[0,0,0,1]],
    },
  };
}

function mockPmCstCrt(preset) {
  return {
    cst: { total_calls: s(45700, preset), ops: s(38200, preset), cps: s(28400, preset), offer_success: s(18600, preset), sale_done: s(9800, preset), success_rate: 21.4 },
    crt: { or: s(7500, preset), cr: s(9800, preset), opr: s(9800, preset), por: s(2200, preset), failure_rate: 27.4 },
  };
}

function mockPmNpsCsat(preset) {
  return {
    nps_score: 10.56,
    csat_score: 72.5,
    detractors: s(3200, preset), passives: s(8100, preset), promoters: s(5400, preset),
    day_wise: {
      categories: ['Mon','Tue','Wed','Thu','Fri'],
      nps: [8.2, 11.4, 10.9, 12.1, 10.2],
      csat: [70.1, 73.2, 72.8, 74.1, 71.8],
    },
  };
}

function mockPmMissedOpportunities(preset) {
  return {
    total_opportunities: s(45700, preset),
    mo_count: s(12500, preset),
    categories: [
      { category: 'Competitor Product', count: s(3200, preset), contr_pct: 25.6, observation: 'Agents failing to address competitor feature gap; no counter-script available' },
      { category: 'Budget Constraint',  count: s(2800, preset), contr_pct: 22.4, observation: 'EMI explanation not being done in 60%+ of objection cases' },
      { category: 'Low Urgency',        count: s(2100, preset), contr_pct: 16.8, observation: 'Agents not creating urgency using limited-time offer language' },
      { category: 'Durability',         count: s(1900, preset), contr_pct: 15.2, observation: 'Product quality rebuttals weak; escalation to supervisor in 30%+ cases' },
      { category: 'Shipping Speed',     count: s(1400, preset), contr_pct: 11.2, observation: 'Delivery timeline not being communicated proactively' },
      { category: 'Hidden Fees',        count: s(1100, preset), contr_pct: 8.8,  observation: 'Transparency gap; agents not disclosing processing fees upfront' },
    ],
  };
}

function mockPmObjectionRebuttal(preset) {
  return [
    { objection: 'Price too high',    rebuttal: 'EMI option',      count: s(1200, preset), failed_rebuttal_pct: 34.2, failed_rebuttal: s(410, preset), successful_rebuttal_pct: 65.8, successful_rebuttal: s(790, preset), conversion_pct: 18.4 },
    { objection: 'Not needed now',    rebuttal: 'Urgency creation', count: s(980, preset),  failed_rebuttal_pct: 51.0, failed_rebuttal: s(500, preset), successful_rebuttal_pct: 49.0, successful_rebuttal: s(480, preset), conversion_pct: 12.1 },
    { objection: 'Competitor better', rebuttal: 'Feature compare',  count: s(820, preset),  failed_rebuttal_pct: 62.4, failed_rebuttal: s(512, preset), successful_rebuttal_pct: 37.6, successful_rebuttal: s(308, preset), conversion_pct: 8.9 },
  ];
}

// ── Mock API override ──

const _MOCK_ROUTES = {
  '/api/callmaster/ceo/scorecard':         (b) => mockCeoScorecard(b.preset || 'MTD'),
  '/api/callmaster/ceo/process-matrix':    (b) => mockCeoProcessMatrix(b.preset || 'MTD'),
  '/api/callmaster/ceo/branch-comparison': (b) => mockCeoBranchComparison(b.preset || 'MTD'),
  '/api/callmaster/ceo/sla-overview':      ()  => ({ sla_pct: 91.4, by_process: [{ process: 'GNC Inbound', sla_pct: 94.1 }, { process: 'Birlanu MCN', sla_pct: 88.2 }] }),
  '/api/callmaster/ceo/risk-exposure':     (b) => ({ total_risk: 312, categories: [{ cat: 'Data Theft', count: 18 }, { cat: 'Escalation Failure', count: 94 }, { cat: 'Sensitive Word', count: 200 }] }),
  '/api/callmaster/ceo/trend':             ()  => mockCeoTrend(),
  '/api/callmaster/ceo/alerts':            (b) => mockCeoAlerts(b.preset || 'MTD'),
  '/api/callmaster/tq/quality-deepdive':   (b) => mockTqQualityDeepdive(b.preset || 'MTD'),
  '/api/callmaster/tq/leaderboard':        (b) => mockTqLeaderboard(b.preset || 'MTD'),
  '/api/callmaster/tq/tni-heatmap':        ()  => ({ agents: ['Anita','Rahul','Kiran','Meera'], params: ['Opening','Compliance','Resolution','Closure'], matrix: [[0,1,0,0],[1,3,0,2],[0,2,1,0],[2,4,3,1]] }),
  '/api/callmaster/tq/coaching-queue':     (b) => ({ open: s(14, b.preset||'MTD'), items: [{ id:1, agent:'Meera Joshi', reason:'Fatal call — escalation failure', priority:'High', status:'Open', due:'2026-06-02' }] }),
  '/api/callmaster/tq/calibration':        ()  => ({ sessions: [{ id:1, date:'2026-05-20', process:'GNC Inbound', variance_score:3.2, status:'Closed' }] }),
  '/api/callmaster/tq/audit-efficiency':   (b) => ({ manual_audits: s(1240, b.preset||'MTD'), ai_audits: s(3800, b.preset||'MTD'), pending: s(180, b.preset||'MTD') }),
  '/api/callmaster/tq/parameter-drift':    ()  => ({ declining: [{ param:'Compliance', change_pct: -4.2 }, { param:'Offer Pitch', change_pct: -6.8 }] }),
  '/api/callmaster/tq/sla-tracker':        ()  => ({ rows: [{ auditor:'Pooja', process:'GNC Inbound', sla_pct:96.2 }, { auditor:'Amit', process:'Birlanu MCN', sla_pct:84.1 }] }),
  '/api/callmaster/pm/overview':           (b) => mockPmOverview(b.preset || 'MTD'),
  '/api/callmaster/pm/parameter-breakdown':(b) => ({ params: [{ param:'Resolution', weight:20, pass_rate:94.7, trend:'up' }, { param:'Compliance', weight:15, pass_rate:88.4, trend:'down' }] }),
  '/api/callmaster/pm/explorer':           (b) => ({ total: 38500, calls: [{ id:'IB-2891', agent:'Ravi Kumar', date:'2026-05-27', score:82.1, band:'Average', severity:'Critical' }] }),
  '/api/callmaster/pm/analyst-scorecard':  (b) => mockPmAnalystScorecard(b.preset || 'MTD'),
  '/api/callmaster/pm/tni-report':         ()  => ({ agents:['Anita','Rahul'], params:['Resolution','Compliance'], matrix:[[0,1],[2,3]] }),
  '/api/callmaster/pm/trends':             ()  => mockCeoTrend(),
  '/api/callmaster/pm/fatal-analysis':     (b) => mockPmFatalAnalysis(b.preset || 'MTD'),
  '/api/callmaster/pm/scenario-breakdown': (b) => ({ scenarios:[{scenario:'Query',score:92.1,calls:s(12000,b.preset||'MTD'),fatal:s(80,b.preset||'MTD')},{scenario:'Complaint',score:89.4,calls:s(9800,b.preset||'MTD'),fatal:s(220,b.preset||'MTD')}] }),
  '/api/callmaster/pm/detail-analysis':    (b) => ({ rows:[{ name:'Anita Sharma', score:97.2, calls:s(320,b.preset||'MTD'), classification:'TQ', params:{ Resolution:100, Compliance:96 } }] }),
  '/api/callmaster/pm/escalation-analysis':(b) => ({ potential_escalations:s(180,b.preset||'MTD'), social_media_threat:s(12,b.preset||'MTD'), scam_mentions:s(8,b.preset||'MTD'), competitor_mentions:s(44,b.preset||'MTD') }),
  '/api/callmaster/pm/cst-crt-funnel':     (b) => mockPmCstCrt(b.preset || 'MTD'),
  '/api/callmaster/pm/missed-opportunities':(b)=> mockPmMissedOpportunities(b.preset || 'MTD'),
  '/api/callmaster/pm/nps-csat':           (b) => mockPmNpsCsat(b.preset || 'MTD'),
  '/api/callmaster/pm/pitch-stage-analysis':(b)=> ({ op:[{category:'Direct Pitch',success_rate:68.2,count:s(18000,b.preset||'MTD')}], offered:[{discount_type:'10%',total_offered:s(8200,b.preset||'MTD'),or_count:s(2100,b.preset||'MTD'),or_pct:25.6,os_count:s(4800,b.preset||'MTD'),os_pct:58.5,sale_count:s(1300,b.preset||'MTD'),conversion_pct:15.9}] }),
  '/api/callmaster/pm/objection-rebuttal': (b) => mockPmObjectionRebuttal(b.preset || 'MTD'),
  '/api/callmaster/bm/health':             (b) => ({ quality_score:87.4, total_calls:s(18500,b.preset||'MTD'), critical_count:s(64,b.preset||'MTD') }),
  '/api/callmaster/bm/process-breakdown':  (b) => ({ processes:[{name:'GNC Inbound',score:91.2,calls:s(8800,b.preset||'MTD')},{name:'Birlanu MCN',score:79.4,calls:s(9700,b.preset||'MTD')}] }),
  '/api/callmaster/bm/team-performance':   (b) => ({ agents:[{name:'Anita Sharma',score:97.2,calls:s(320,b.preset||'MTD'),risk:0,coaching:'None'}] }),
  '/api/callmaster/bm/daily-sla':          ()  => ({ coverage_pct:88.4, audited:s(1240,'D1'), total:s(1400,'D1'), breaches:[] }),
  '/api/callmaster/bm/risk-calls':         (b) => ({ calls:[{id:'IB-2891',agent:'Ravi Kumar',severity:'Critical',reason:'Data theft',date:'2026-05-27'}] }),
  '/api/callmaster/bm/action-items':       ()  => ({ items:[{id:1,type:'Coaching',agent:'Meera Joshi',due:'2026-06-02',status:'Open'}] }),
  '/api/callmaster/analyst/overview':      (b) => ({ my_score:88.9, my_calls:s(310,b.preset||'MTD'), my_fatal:2, target_cq_pct:95 }),
  '/api/callmaster/analyst/defects':       (b) => ({ params:[{param:'Compliance',lost_marks:s(18,b.preset||'MTD')},{param:'Resolution',lost_marks:s(8,b.preset||'MTD')}] }),
  '/api/callmaster/analyst/my-calls':      (b) => ({ total:s(310,b.preset||'MTD'), calls:[{id:'IB-2910',date:'2026-05-27',score:82.1,band:'Average',severity:'Normal'}] }),
  '/api/callmaster/analyst/trend':         ()  => mockCeoTrend(),
  '/api/callmaster/analyst/coaching':      ()  => ({ sessions:[{id:1,date:'2026-05-20',coach:'Pooja',notes:'Work on compliance script adherence',status:'Acknowledged'}] }),
};

// Override CALLMASTER_API.request when USE_MOCK_DATA=true
if (typeof CALLMASTER_API !== 'undefined' && USE_MOCK_DATA) {
  CALLMASTER_API.request = async function(path, options = {}) {
    const key = path.replace(/\/[0-9]+$/, '/:id');  // normalize :id routes
    const handler = _MOCK_ROUTES[path] || _MOCK_ROUTES[key];
    if (!handler) {
      console.warn('[mock] No mock for', path);
      return { success: true, data: [] };
    }
    const body = options.body ? JSON.parse(options.body) : {};
    await new Promise(r => setTimeout(r, 80));  // simulate network latency
    return { success: true, data: handler(body) };
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add public/callmaster/js/mock.js
git commit -m "feat(callmaster): add mock data layer for all 40+ endpoints with preset scaling"
```

---

## Task 12: Main app shell — index.html + app.js

**Files:**
- Create: `public/callmaster/index.html`
- Create: `public/callmaster/js/app.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Call Master — Intelligence Dashboard</title>
  <link rel="stylesheet" href="/callmaster/css/design-system.css" />
  <script src="https://cdn.jsdelivr.net/npm/apexcharts@3.49.0/dist/apexcharts.min.js"></script>
</head>
<body>

<!-- ── Login overlay ── -->
<div id="loginOverlay">
  <div class="login-card">
    <div class="login-title">Call Master</div>
    <div class="login-sub">Intelligence Dashboard · Sign in to continue</div>
    <div class="form-group">
      <label class="form-label" for="loginUsername">Username</label>
      <input class="form-input" id="loginUsername" type="text" autocomplete="username" placeholder="Enter username" />
    </div>
    <div class="form-group">
      <label class="form-label" for="loginPassword">Password</label>
      <input class="form-input" id="loginPassword" type="password" autocomplete="current-password" placeholder="Enter password" />
    </div>
    <div class="login-error" id="loginError"></div>
    <button class="btn btn-primary btn-full" id="loginBtn" onclick="doLogin()">Sign In</button>
  </div>
</div>

<!-- ── App shell ── -->
<div id="appShell">
  <nav id="sidebar">
    <div class="nav-logo">
      <div class="logo-icon">CM</div>
      <div class="logo-text">Call Master</div>
    </div>
    <div id="navLinks"></div>
  </nav>

  <div id="mainArea">
    <div id="topbar">
      <div class="topbar-title" id="topbarTitle">Dashboard</div>
      <div id="topbarFilters"></div>
      <span class="persona-badge" id="personaBadge"></span>
      <span class="topbar-user" id="topbarUser"></span>
    </div>
    <section id="pageContent"></section>
  </div>
</div>

<!-- ── Drawer ── -->
<div id="drawerRoot">
  <div class="drawer-overlay" onclick="closeDrawer()"></div>
  <div class="drawer-panel">
    <div class="drawer-header">
      <div class="drawer-title"></div>
      <button class="drawer-close" onclick="closeDrawer()">×</button>
    </div>
    <div class="drawer-body"></div>
  </div>
</div>

<!-- ── Toast container ── -->
<div id="toastContainer"></div>

<!-- ── Scripts ── -->
<script src="/callmaster/js/shared/components.js"></script>
<script src="/callmaster/js/shared/charts.js"></script>
<script src="/callmaster/js/pages/ceo.js"></script>
<script src="/callmaster/js/pages/tq.js"></script>
<script src="/callmaster/js/pages/pm.js"></script>
<script src="/callmaster/js/pages/bm.js"></script>
<script src="/callmaster/js/pages/analyst.js"></script>
<script src="/callmaster/js/pages/admin.js"></script>
<script src="/callmaster/js/app.js"></script>
<script src="/callmaster/js/mock.js"></script>

</body>
</html>
```

- [ ] **Step 2: Create app.js**

```javascript
// public/callmaster/js/app.js

// ── API client ──
const CALLMASTER_API = {
  _token: null,
  setToken(t) { this._token = t; },
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    const res = await fetch(path, { headers, ...options });
    if (res.status === 401) { doLogout(); return { success: false }; }
    return res.json();
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  get(path) {
    return this.request(path);
  },
};

// ── State ──
const state = {
  page: null,
  preset: 'MTD',
  user: null,
};

// ── JWT helpers ──
function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  } catch { return null; }
}

// ── Nav definitions per role ──
const NAV_CONFIG = {
  admin: [
    { label: 'User Management',   page: 'admin-users',       icon: '👥' },
    { label: 'Process Config',    page: 'admin-processes',   icon: '⚙️' },
    { label: 'Data Sources',      page: 'admin-data-sources',icon: '🗄️' },
    { label: 'Impersonate',       page: 'admin-impersonate', icon: '🎭' },
    { label: 'System Health',     page: 'admin-health',      icon: '💚' },
    { label: 'Audit Config',      page: 'admin-audit-config',icon: '📋' },
  ],
  ceo: [
    { label: 'Org Scorecard',     page: 'ceo-scorecard',       icon: '🏆' },
    { label: 'Process Matrix',    page: 'ceo-process-matrix',  icon: '📊' },
    { label: 'Branch Comparison', page: 'ceo-branch-comparison',icon: '🏢' },
    { label: 'SLA Compliance',    page: 'ceo-sla-overview',    icon: '⏱️' },
    { label: 'Risk Exposure',     page: 'ceo-risk-exposure',   icon: '🚨' },
    { label: 'Month Trend',       page: 'ceo-trend',           icon: '📈' },
    { label: 'Critical Alerts',   page: 'ceo-alerts',          icon: '🔔' },
  ],
  tq_head: [
    { label: 'Quality Deep-Dive', page: 'tq-quality-deepdive', icon: '🔬' },
    { label: 'TNI Heatmap',       page: 'tq-tni-heatmap',      icon: '🌡️' },
    { label: 'Analyst Leaderboard',page: 'tq-leaderboard',     icon: '🥇' },
    { label: 'Coaching Queue',    page: 'tq-coaching-queue',   icon: '🎓' },
    { label: 'Calibration',       page: 'tq-calibration',      icon: '⚖️' },
    { label: 'Audit Efficiency',  page: 'tq-audit-efficiency', icon: '📌' },
    { label: 'Parameter Drift',   page: 'tq-parameter-drift',  icon: '📉' },
    { label: 'SLA Tracker',       page: 'tq-sla-tracker',      icon: '✅' },
  ],
  branch_manager: [
    { label: 'Branch Health',     page: 'bm-health',            icon: '💪' },
    { label: 'Process Breakdown', page: 'bm-process-breakdown', icon: '📊' },
    { label: 'Team Performance',  page: 'bm-team-performance',  icon: '👥' },
    { label: 'Daily SLA',         page: 'bm-daily-sla',         icon: '⏱️' },
    { label: 'Risk Calls',        page: 'bm-risk-calls',        icon: '🚨' },
    { label: 'Action Items',      page: 'bm-action-items',      icon: '✅' },
  ],
  process_manager: [
    { label: 'Process Overview',  page: 'pm-overview',          icon: '📊' },
    { label: 'Parameters',        page: 'pm-parameters',        icon: '📋' },
    { label: 'Call Explorer',     page: 'pm-explorer',          icon: '🔍' },
    { label: 'Analyst Scorecard', page: 'pm-analyst-scorecard', icon: '🥇' },
    { label: 'TNI Report',        page: 'pm-tni',               icon: '🌡️' },
    { label: 'Daily Trends',      page: 'pm-trends',            icon: '📈' },
    { label: 'Evidence Viewer',   page: 'pm-evidence',          icon: '🎧' },
    { label: 'Defect Analysis',   page: 'pm-defect-analysis',   icon: '🔎' },
    { label: '── Inbound ──',     page: null,                   icon: '' },
    { label: 'Fatal Analysis',    page: 'pm-fatal-analysis',    icon: '⚠️' },
    { label: 'Scenario Breakdown',page: 'pm-scenario',          icon: '📂' },
    { label: 'Detail Analysis',   page: 'pm-detail-analysis',   icon: '📑' },
    { label: 'Escalation',        page: 'pm-escalation',        icon: '🔥' },
    { label: '── Outbound ──',    page: null,                   icon: '' },
    { label: 'CST/CRT Funnel',    page: 'pm-cst-crt',           icon: '🔽' },
    { label: 'Missed Opportunity',page: 'pm-missed-opp',        icon: '💸' },
    { label: 'NPS & CSAT',        page: 'pm-nps-csat',          icon: '😊' },
    { label: 'Pitch Stage',       page: 'pm-pitch-stage',       icon: '🎯' },
    { label: 'Objection Rebuttal',page: 'pm-objection-rebuttal',icon: '🥊' },
  ],
  analyst: [
    { label: 'My Score',          page: 'analyst-overview',  icon: '⭐' },
    { label: 'My Defects',        page: 'analyst-defects',   icon: '📉' },
    { label: 'My Calls',          page: 'analyst-calls',     icon: '📞' },
    { label: 'Evidence Review',   page: 'analyst-evidence',  icon: '🎧' },
    { label: 'Score Trend',       page: 'analyst-trend',     icon: '📈' },
    { label: 'Coaching',          page: 'analyst-coaching',  icon: '🎓' },
  ],
};

// ── Page registry — maps page key → render function ──
function getPageFn(page) {
  return CEO_PAGES[page] || TQ_PAGES[page] || PM_PAGES[page] ||
         BM_PAGES[page]  || ANALYST_PAGES[page] || ADMIN_PAGES[page] || null;
}

// ── Router ──
function go(page, preset) {
  if (!state.user) return;
  if (preset) state.preset = preset;
  state.page = page;

  destroyAllCharts();

  const fn = getPageFn(page);
  const pc = document.getElementById('pageContent');
  if (!fn) {
    pc.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-text">Page not found: ${page}</div></div>`;
    return;
  }

  // Show skeleton while loading
  pc.innerHTML = skeleton();

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Render the page (fn may be async)
  Promise.resolve(fn(state.preset)).then(html => {
    if (state.page === page) {  // guard against race conditions
      pc.innerHTML = html;
    }
  }).catch(err => {
    pc.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${err.message}</div></div>`;
  });
}

// ── Sidebar builder ──
function buildNav(role) {
  const items = NAV_CONFIG[role] || [];
  const container = document.getElementById('navLinks');
  container.innerHTML = items.map(item => {
    if (!item.page) {
      return `<div class="nav-section-label">${item.label}</div>`;
    }
    return `<div class="nav-item" data-page="${item.page}" onclick="go('${item.page}')">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
    </div>`;
  }).join('');
}

// ── Login / logout ──
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');

  if (!username || !password) { errEl.textContent = 'Please enter username and password'; return; }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.textContent = '';

  try {
    let result;
    if (typeof USE_MOCK_DATA !== 'undefined' && USE_MOCK_DATA) {
      // Mock login: any password works for demo users
      const mockUsers = {
        'admin':    { role: 'admin',           branch_ids: ['*'], process_ids: ['*'] },
        'ceo':      { role: 'ceo',             branch_ids: ['*'], process_ids: ['*'] },
        'tq':       { role: 'tq_head',         branch_ids: ['*'], process_ids: ['*'] },
        'bm':       { role: 'branch_manager',  branch_ids: ['Delhi NCR'], process_ids: ['*'] },
        'pm':       { role: 'process_manager', branch_ids: ['*'], process_ids: ['GNC Inbound'] },
        'analyst':  { role: 'analyst',         branch_ids: ['Delhi NCR'], process_ids: ['GNC Inbound'], employee_code: 'EMP001' },
      };
      const u = mockUsers[username.toLowerCase()];
      if (!u) { errEl.textContent = 'Mock users: admin, ceo, tq, bm, pm, analyst'; btn.disabled = false; btn.textContent = 'Sign In'; return; }
      result = { success: true, token: 'mock.token.payload', user: { ...u, username, full_name: username.charAt(0).toUpperCase() + username.slice(1), user_id: 1, employee_code: u.employee_code || null } };
      CALLMASTER_API._token = result.token;
    } else {
      result = await CALLMASTER_API.post('/api/callmaster/auth/login', { username, password });
    }

    if (!result.success) { errEl.textContent = result.message || 'Login failed'; return; }

    onLogin(result.token, result.user);
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function onLogin(token, user) {
  state.user = user;
  CALLMASTER_API.setToken(token);
  sessionStorage.setItem('cm_token', token);
  sessionStorage.setItem('cm_user', JSON.stringify(user));

  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('personaBadge').className = `persona-badge badge-${user.role}`;
  document.getElementById('personaBadge').textContent = user.role.replace('_', ' ').toUpperCase();
  document.getElementById('topbarUser').textContent = user.full_name;

  buildNav(user.role);

  // Navigate to first real page for this role
  const firstPage = (NAV_CONFIG[user.role] || []).find(i => i.page);
  if (firstPage) go(firstPage.page);
}

function doLogout() {
  sessionStorage.removeItem('cm_token');
  sessionStorage.removeItem('cm_user');
  state.user = null;
  state.page = null;
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('navLinks').innerHTML = '';
  document.getElementById('pageContent').innerHTML = '';
}

// ── Enter key on login form ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginOverlay').classList.contains('hidden')) {
    doLogin();
  }
});

// ── Auto-restore session ──
(function restoreSession() {
  const token = sessionStorage.getItem('cm_token');
  const user  = sessionStorage.getItem('cm_user');
  if (token && user) {
    try {
      onLogin(token, JSON.parse(user));
    } catch {
      doLogout();
    }
  }
})();
```

- [ ] **Step 3: Verify the server can find the files**

```bash
npm run dev
```

Open in browser: `http://localhost:5050/callmaster/`

Expected: Login screen appears on OLED dark background with "Call Master — Intelligence Dashboard" title.

- [ ] **Step 4: Test mock login**

Enter username `admin` (any password) and click Sign In.
Expected: Login overlay hides, sidebar shows Admin nav items, page content shows Admin stub pages.

Test other roles: `ceo`, `tq`, `bm`, `pm`, `analyst`.

- [ ] **Step 5: Commit**

```bash
git add public/callmaster/index.html public/callmaster/js/app.js
git commit -m "feat(callmaster): add app shell with login, JWT auth, role-based nav, router, mock layer"
```

---

## Task 13: Final integration test

- [ ] **Step 1: Run TypeScript compilation check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Restart dev server and run all smoke tests**

```bash
npm run dev
```

Test checklist — open browser to `http://localhost:5050/callmaster/`:

| Test | Expected |
|---|---|
| Login overlay shows on load | ✅ |
| Login with `admin` / any password | ✅ nav shows 6 admin items |
| Login with `ceo` | ✅ nav shows 7 CEO items |
| Login with `tq` | ✅ nav shows 8 T&Q items |
| Login with `pm` | ✅ nav shows 17 PM items (8 shared + inbound/outbound sections) |
| Login with `bm` | ✅ nav shows 6 BM items |
| Login with `analyst` | ✅ nav shows 6 analyst items |
| Click any nav item | ✅ stub "coming in Plan N" page renders |
| Refresh page | ✅ session restores from sessionStorage |
| `GET /api/callmaster/auth/me` with valid token | ✅ returns user object |
| `POST /api/callmaster/auth/login` wrong password | ✅ 401 returned |

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(callmaster): Plan 1 foundation complete — auth, shell, design system, mock layer, all 6 persona stubs"
```

---

## Plan 1 Complete

Foundation is done. Plans 2–4 depend on this being deployed and the mock layer working.

**Next: [Plan 2 — CEO & T&Q Head](2026-05-27-callmaster-plan2-ceo-tq.md)**
