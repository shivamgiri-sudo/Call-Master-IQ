# Call Master Org Dashboard — Design Specification

**Date:** 2026-05-27  
**Version:** 1.0  
**Author:** Project Lead (AI)  
**Status:** Awaiting user approval

---

## 1. Overview

**Goal:** Build an organization-level multi-process call quality intelligence dashboard integrated into the existing `call-master-backend` TypeScript/Express application, covering all inbound and outbound call processes with 6 distinct authenticated personas.

**Out of scope (Phase 2):** Chat and Email processes.

---

## 2. Database Architecture

Three existing MySQL databases are used. No schema changes are needed to the source DBs.

| Pool | Database | Access | Role |
|---|---|---|---|
| `dbExternalPool` | `db_external` | Read-only | Outbound call audit data (`CallDetails`) |
| `dbAuditPool` | `db_audit` | Read-only | Inbound call QA data (`call_quality_assessment`) |
| `db` (Shivamgiri) | `Shivamgiri` | Read + Write | Unified views, process config, user management, coaching, calibration, insights |

### Key Tables & Views Already in Place

**Shivamgiri (write DB) — pre-built views:**
- `v_call_master_unified_kpi` — UNION of inbound + outbound KPI rows; columns: `source_call_id`, `source_type`, `client_id`, `process_name`, `business_lob`, `branch_short_name`, `campaign_name`, `agent_employee_code`, `agent_employee_name`, `call_date`, `quality_score`, `quality_band`, `is_critical_call`, `alert_severity` (Critical/High/Medium/Normal)
- `v_call_master_inbound_kpi` — Inbound KPI rows from `db_audit.call_quality_assessment`
- `v_call_master_outbound_kpi` — Outbound KPI rows from `db_external.CallDetails`

**Quality Band Definitions (Looker-aligned — overrides original Hit/Watch/Miss):**

| Band | Score Range | Source |
|---|---|---|
| Excellent | 98–100% | Inbound + Outbound |
| Good | 90–97% | Inbound + Outbound |
| Average | 85–89% | Inbound + Outbound |
| Below Average | < 85% | Inbound + Outbound |

Configurable **target line** per process stored in `process_mapping_master.target_cq_pct`:
- Inbound default: **95%**
- Outbound default: **80%**

**Agent Classification by Avg CQ% (Inbound):**
- TQ (Top Quartile): agent avg ≥ target + 5%
- MQ (Mid Quartile): agent avg between target – 5% and target + 5%
- BQ (Bottom Quartile): agent avg < target – 5%

**Shivamgiri — config + write tables:**
- `process_mapping_master` — maps `dialdesk_client_id` → `process_name`, `business_lob`, `branch`, `source_type`
- `employee_mapping_master` + `employee_source_alias` — agent name → employee code → employee name resolution
- `manual_qa_audit` — 19-parameter inbound QA scores per call
- `audit_prompt_config` — per-process AI QC prompt configuration
- `calibration_session` + `calibration_call` — calibration workflow
- `call_coaching_queue` — coaching task assignments
- `call_ai_insight` — AI-generated per-call insights
- `call_feedback_log` — analyst dispute/feedback on audits
- `dashboard_exclusion_rules` — exclude inactive clients/campaigns from queries

**New tables to be created in Shivamgiri:**
- `cm_users` — Call Master user accounts (username, hashed password, role, branch_ids, process_ids)
- `cm_coaching_notes` — coaching session notes linked to analyst + call

---

## 3. Tech Stack

### Backend
- TypeScript + Express 5 (existing `call-master-backend`)
- New module folder: `src/callmaster/`
- Shares all three existing DB pools
- JWT tokens extended to carry: `{ user_id, role, branch_ids[], process_ids[], name }`
- Mounted at `/api/callmaster/` prefix — no collision with existing routes

### Frontend
- Vanilla JS — no build step, no framework
- Served from `public/callmaster/`
- Entry point: `public/callmaster/index.html`
- OLED dark design system (same visual language as Finnable Intelligence)
- ApexCharts via CDN for all charts
- `USE_MOCK_DATA = true` toggle in `js/mock.js` — flipped to false per-process as real schemas confirmed
- JetBrains Mono + Inter fonts via CDN

---

## 4. File Structure

### Backend
```
src/callmaster/
  config/
    processRegistry.ts     ← maps process_id → source_type, db pool, table, parameter list
  middleware/
    cmAuth.ts              ← JWT validation + role guard + branch/process scope injection
  repositories/
    baseRepository.ts      ← shared query builder, pagination, date-range helpers
    unifiedKpiRepo.ts      ← queries v_call_master_unified_kpi (all personas)
    inboundRepo.ts         ← queries db_audit.call_quality_assessment detail
    outboundRepo.ts        ← queries db_external.CallDetails detail
    coachingRepo.ts        ← coaching queue + notes (Shivamgiri write)
    analystRepo.ts         ← analyst self-view queries (scoped to own employee_code)
  services/
    orgService.ts          ← CEO-level aggregates (all branches, all processes)
    qualityService.ts      ← T&Q deep-dive (TNI, parameter drift, calibration, audit SLA)
    branchService.ts       ← Branch Manager aggregates (scoped to branch_ids)
    processService.ts      ← Process Manager deep-dive (scoped to process + source_type)
    analystService.ts      ← Analyst self-view (scoped to own employee_code)
    adminService.ts        ← User management, process config, system health
  routes/
    cmAuth.ts              ← POST /api/callmaster/auth/login
    ceo.ts                 ← GET/POST /api/callmaster/ceo/*
    tq.ts                  ← GET/POST /api/callmaster/tq/*
    bm.ts                  ← GET/POST /api/callmaster/bm/*
    pm.ts                  ← GET/POST /api/callmaster/pm/*
    analyst.ts             ← GET/POST /api/callmaster/analyst/*
    admin.ts               ← GET/POST /api/callmaster/admin/*
```

### Frontend
```
public/callmaster/
  index.html               ← shell: sidebar nav, topbar, #pageContent mount, login overlay
  css/
    design-system.css      ← OLED dark theme, typography, components (shared by all personas)
  js/
    app.js                 ← router, JWT auth, CALLMASTER_API client, navigation, go()
    mock.js                ← USE_MOCK_DATA + mock data factories for all personas
    shared/
      components.js        ← kpi(), table(), drawer(), emptyState(), skeleton()
      charts.js            ← ApexCharts wrappers: lineChart(), barChart(), donutChart(), heatmapChart()
    pages/
      ceo.js               ← 7 page renderers + data loaders for CEO persona
      tq.js                ← 8 page renderers + data loaders for T&Q Head persona
      bm.js                ← 6 page renderers + data loaders for Branch Manager persona
      pm.js                ← 8 page renderers + data loaders for Process Manager persona
      analyst.js           ← 6 page renderers + data loaders for Analyst persona
      admin.js             ← 6 page renderers + data loaders for Admin persona
```

---

## 5. Authentication & Role Model

### Login Flow
1. `POST /api/callmaster/auth/login` with `{ username, password }`
2. `cmAuth` middleware validates credentials against `cm_users` table (Shivamgiri)
3. On success: issue JWT containing `{ user_id, name, role, branch_ids, process_ids, iat, exp }`
4. Frontend stores JWT in `sessionStorage`, decodes payload for persona routing
5. All subsequent requests: `Authorization: Bearer <token>` header

### Roles & Scopes

| Role | JWT scope | Data access |
|---|---|---|
| `admin` | `branch_ids: ['*']`, `process_ids: ['*']` | Everything; can impersonate any role |
| `ceo` | `branch_ids: ['*']`, `process_ids: ['*']` | All data; summary only; no call-level detail |
| `tq_head` | `branch_ids: ['*']`, `process_ids: ['*']` | All data; analyst-level detail; no PII bypass |
| `branch_manager` | `branch_ids: [<assigned>]`, `process_ids: ['*']` | Own branches only; all processes within branch |
| `process_manager` | `branch_ids: ['*']`, `process_ids: [<assigned>]` | Assigned processes only; full call-level detail |
| `analyst` | `branch_ids: [<own branch>]`, `process_ids: [<own processes>]` | Own employee_code only; no peer data |

### `cm_users` Table Schema (new — Shivamgiri)
```sql
CREATE TABLE cm_users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL,
  role          ENUM('admin','ceo','tq_head','branch_manager','process_manager','analyst') NOT NULL,
  branch_ids    JSON,        -- array of branch_short_name values, or ["*"]
  process_ids   JSON,        -- array of process_name values, or ["*"]
  employee_code VARCHAR(100), -- for analyst role: links to employee_mapping_master
  active        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. API Endpoints

All routes require `Authorization: Bearer <token>` except the login endpoint.  
All POST endpoints accept a JSON body with `{ preset, filters }` where applicable.  
`preset` values: `'MTD'` | `'WTD'` | `'D1'`

### Auth
```
POST /api/callmaster/auth/login        { username, password } → { token, user }
GET  /api/callmaster/auth/me           → { user_id, name, role, branch_ids, process_ids }
```

### CEO
```
POST /api/callmaster/ceo/scorecard     → org quality score + per-process breakdown
POST /api/callmaster/ceo/process-matrix → Outbound vs Inbound side-by-side KPI table (Phase 1; Chat/Email added in Phase 2)
POST /api/callmaster/ceo/branch-comparison → branch ranking by quality + volume + risk
POST /api/callmaster/ceo/sla-overview  → audit SLA % by process + branch
POST /api/callmaster/ceo/risk-exposure → high-risk call counts + top categories + trend
POST /api/callmaster/ceo/trend         → 90-day quality score trend all processes
POST /api/callmaster/ceo/alerts        → critical + high severity calls today
```

### T&Q Head
```
POST /api/callmaster/tq/quality-deepdive → parameter breakdown + score trends per process
POST /api/callmaster/tq/tni-heatmap      → analyst × parameter defect matrix
POST /api/callmaster/tq/leaderboard      → cross-process analyst ranking + coaching priority
POST /api/callmaster/tq/coaching-queue   → pending + completed coaching sessions
POST /api/callmaster/tq/calibration      → calibration sessions list + variance scores
POST /api/callmaster/tq/audit-efficiency → manual vs AI QC volumes + pending audit count
POST /api/callmaster/tq/parameter-drift  → parameters declining over 30 days (early warning)
POST /api/callmaster/tq/sla-tracker      → audit SLA performance per auditor per process
POST /api/callmaster/tq/coaching-notes   → add/update coaching note for an analyst (write to cm_coaching_notes)
```

### Branch Manager
```
POST /api/callmaster/bm/health          → branch combined quality score + all processes
POST /api/callmaster/bm/process-breakdown → per-process quality within branch
POST /api/callmaster/bm/team-performance  → analyst-wise quality, volume, risk, coaching
POST /api/callmaster/bm/daily-sla        → today's audit coverage + pending + breached
POST /api/callmaster/bm/risk-calls       → high-risk calls from branch, action required
POST /api/callmaster/bm/action-items     → pending coaching follow-ups + escalations
```

### Process Manager
```
POST /api/callmaster/pm/overview             → process quality score, volume, defect summary
POST /api/callmaster/pm/parameter-breakdown  → process-specific parameters with weights + scores
POST /api/callmaster/pm/explorer             → call/ticket explorer with search + filter + pagination
POST /api/callmaster/pm/analyst-scorecard    → analysts in this process ranked by score; TQ/MQ/BQ classification
POST /api/callmaster/pm/tni-report           → this process's TNI breakdown
POST /api/callmaster/pm/trends               → day-wise quality score + volume + defect chart
GET  /api/callmaster/pm/call/:id             → full call detail + transcript + evidence
POST /api/callmaster/pm/defect-analysis      → Outbound: CST/CRT dual-track funnel · Inbound: defect category breakdown

# Inbound-only endpoints
POST /api/callmaster/pm/fatal-analysis       → fatal call %, fatal contributors, day-wise fatal trend, scenario×fatal heatmap
POST /api/callmaster/pm/scenario-breakdown   → Inbound: Query/Complaint/Request/Sale Done dimension + filter
POST /api/callmaster/pm/detail-analysis      → agent×parameter scorecard, day-wise + week-wise tables, TQ/MQ/BQ
POST /api/callmaster/pm/escalation-analysis  → 5 negative signals, social media threat, scam table, competitor section

# Outbound-only endpoints
POST /api/callmaster/pm/cst-crt-funnel       → CST (OPS→CPS→Offer Success→Sale Done) + CRT (OR→CR→OPR→POR)
POST /api/callmaster/pm/missed-opportunities → MO categories + AI observations + NED/ED analysis
POST /api/callmaster/pm/nps-csat             → NPS gauge + CSAT gauge + day-wise trend table
POST /api/callmaster/pm/pitch-stage-analysis → Opening/Context/Offered pitch stage breakdowns + discount type table
POST /api/callmaster/pm/objection-rebuttal   → objection × rebuttal effectiveness: failed/successful rebuttal%, conversion%
```

### Analyst
```
POST /api/callmaster/analyst/overview      → my quality score across my processes MTD/WTD/D1
POST /api/callmaster/analyst/defects       → parameters where I'm losing marks
POST /api/callmaster/analyst/my-calls      → my audited calls, filterable + paginated
GET  /api/callmaster/analyst/call/:id      → my call detail + transcript + scoring rationale
POST /api/callmaster/analyst/trend         → my day-wise quality movement + target line
GET  /api/callmaster/analyst/coaching      → coaching notes received from T&Q / PM
```

### Admin
```
GET    /api/callmaster/admin/users          → list all users
POST   /api/callmaster/admin/users          → create user
PUT    /api/callmaster/admin/users/:id      → update user (role, branches, processes)
DELETE /api/callmaster/admin/users/:id      → deactivate user
GET    /api/callmaster/admin/processes      → list process_mapping_master entries
POST   /api/callmaster/admin/impersonate    → issue a temporary token for another role (admin only)
GET    /api/callmaster/admin/system-health  → DB pool status + response time + error rates
```

---

## 7. Frontend Architecture

### Single HTML Shell (`index.html`)
The shell contains:
- Login overlay (full-screen, shown when no valid JWT in sessionStorage)
- Sidebar navigation (links change based on decoded role from JWT)
- Topbar (persona badge, branch/process filter, period slicer for standalone pages)
- `<section id="pageContent">` — all page content renders here
- `<div id="drawerRoot">` — full-page drawers (call detail, analyst cockpit)

### Router (`app.js`)
```
CALLMASTER_API.request(path, options) → fetch with Bearer token
go(page) → sets state.page, renders correct JS page module, shows/hides filters
onLogin(token) → decode JWT, store, build sidebar nav for role, go('overview')
```

### Period Slicers
- MTD / WTD / D-1 buttons on every analytics page
- `setActivePreset(preset)` scoped to `#pageContent .preset-btn[data-preset]`
- Each page loader calls `setActivePreset(preset)` on every load

### Mock Data (`mock.js`)
```js
const USE_MOCK_DATA = true;  // flip to false when real DB confirmed
// Overrides CALLMASTER_API.request globally
// buildMock<Persona>(preset) factories scale numbers by preset (MTD=1.0, WTD=0.27, D1=0.04)
// Covers all 40+ API endpoints
```

---

## 8. Page Inventory

### CEO (7 pages)
| Page | Key Components |
|---|---|
| Org Quality Scorecard | 4 KPI cards (Outbound score, Inbound score, Total calls, Critical calls) + period slicer |
| Process Health Matrix | 2×4 comparison table (Outbound vs Inbound × quality/volume/SLA/risk) + sparklines |
| Branch Comparison | Ranked table: branch × quality score, call volume, critical count, trend |
| SLA Compliance | Donut chart per process + table of SLA % by branch |
| Risk Exposure | Bar chart top risk categories + KPIs + trend line |
| Month Trend | 90-day multi-line chart (Outbound + Inbound quality score overlay) |
| Critical Alerts | Feed of today's Critical + High severity calls; click → call detail drawer |

### T&Q Head (8 pages)
| Page | Key Components |
|---|---|
| Quality Deep-Dive | Tab switcher Inbound/Outbound + parameter bar chart + score trend |
| TNI Heatmap | ApexCharts heatmap: rows=analysts, cols=parameters, cell=defect count |
| Analyst Leaderboard | Cross-process ranking table; click → analyst trend drawer |
| Coaching Queue | Table of open coaching items + status + due date; mark complete action |
| Calibration Tracker | Session list + variance scores + open/closed status |
| Audit Efficiency | KPIs: manual audits, AI audits, pending; daily volume bar chart |
| Parameter Drift | Line chart per declining parameter, last 30 days |
| SLA Tracker | Auditor × process audit SLA %; highlight breaches |

### Branch Manager (6 pages)
| Page | Key Components |
|---|---|
| Branch Health | Combined quality score + process breakdown donut + period slicer |
| Process Breakdown | 2-col card grid: one per process, score + volume + trend sparkline |
| Team Performance | Analyst table: quality, calls, risk, coaching status; click → analyst drawer |
| Daily SLA | Today's coverage %: audited vs total calls; breach list |
| Risk Call Feed | Paginated list of high-risk calls from branch; click → call detail |
| Action Items | Pending coaching + escalation list; mark resolved |

### Process Manager (15 pages — 8 shared + 4 Inbound-only + 5 Outbound-only — rendered by source_type)

**Shared (both Inbound & Outbound):**

| Page | Key Components |
|---|---|
| Process Overview | KPI strip (quality score, calls, defects, critical) + period slicer + target line annotation |
| Parameter Breakdown | Process-specific parameter table: weight, pass rate, trend; click → evidence |
| Call Explorer | Search + filter (date, agent, score band, alert severity, scenario[Inbound]) + paginated table |
| Analyst Scorecard | Analyst table ranked by score + TQ/MQ/BQ badge; click → trend drawer |
| TNI Report | Parameter × analyst defect heatmap (own process) |
| Daily Trends | Day-wise line chart (quality score + target line) + bar chart (call volume) |
| Evidence Viewer | Call detail: score breakdown, transcript, parameter-linked evidence highlights |
| ACHT Bucketing | Call duration distribution (0–2min, 2–5min, 5–10min, 10+min) — Inbound only; auto-hidden for Outbound |

**Inbound-only pages (hidden for Outbound processes):**

| Page | Key Components |
|---|---|
| Fatal Analysis | Fatal% KPI + Without-Fatal CQ% KPI + Top 5 Fatal Contributors bar chart + day-wise fatal% line chart + Scenario×Fatal heatmap + Week×Scenario fatal table |
| Scenario Breakdown | Tabs: Query / Complaint / Request / Sale Done; per-scenario quality score, call volume, fatal count, top defect parameters |
| Detail Analysis | Agent × parameter scorecard table; day-wise performance table; week-wise performance table; TQ/MQ/BQ column with threshold bands |
| Escalation Analysis | Potential escalation KPIs; 5 negative signal counts; social media threat flag count; scam mention day-wise table; competitor mention analysis section; escalation detail panel (expandable per call) |

**Outbound-only pages (hidden for Inbound processes):**

| Page | Key Components |
|---|---|
| CST/CRT Funnel | CST panel (OPS→CPS→Offer Success→Sale Done + Success Rate) + CRT panel (OR→CR→OPR→POR + Failure Rate) + dual funnel charts + SCB/RCB breakdown |
| Missed Opportunity Analysis | Total Opp + MO count KPIs; MO category table (AI Observations, Count, Contr%); NED/ED analysis table (status: Workable/Not, Count, Contr%); MO Breakdown + Breakup charts |
| NPS & CSAT | NPS gauge (Detractors/Passives/Promoters + numeric score) + CSAT gauge (%); day-wise table (Calldate, Detractor, Passive, Promoter, CSAT_Score, Total_Feedback); dual-axis day-wise trend chart |
| Pitch Stage Analysis | OP Analysis — Opening category-wise success; Context Setting Analysis; Offered Pitch Analysis by Discount Type table (DiscountType, OR Count, OR%, OS Count, OS%, Sale Count, Conversion%) |
| Objection Rebuttal | Main Objection × Agent Rebuttal table (Objection Count, Failed Rebuttal%, Failed Rebuttal, Successful Rebuttal%, Successful Rebuttal, Conversion%); POS Subcategory Breakdown; Rebuttal Breakdown chart |

### Analyst (6 pages)
| Page | Key Components |
|---|---|
| My Score Overview | My quality score cards by process + MTD/WTD/D-1 |
| My Defect Breakdown | Bar chart: parameters where I lost marks + count |
| My Call List | My audited calls table; filter by date + score band |
| Evidence Review | My call detail + transcript + scoring evidence (read-only) |
| Score Trend | My day-wise quality line chart + target line |
| Coaching Notes | Timeline of coaching sessions received; expand for details |

### Admin (6 pages)
| Page | Key Components |
|---|---|
| User Management | Table of all cm_users; create/edit/deactivate inline |
| Branch & Process Config | process_mapping_master viewer; add/edit process assignments |
| Data Source Mapping | ProcessRegistry viewer; shows which DB/table each process reads from |
| Role Impersonation | Select user → issue temp token → switch view to that persona |
| System Health | DB pool status (3 pools), API avg response times, error count last 24h |
| Audit Configuration | manual_qa_audit parameter weights per process; audit_prompt_config viewer |

---

## 9. Design System

Inherits the Finnable OLED dark visual language exactly:
- Background: `#060a14`; Surface: `#0d1424`; Surface2: `#111827`
- Primary: `#3b82f6`; Accent: `#06d6a0`; Gold: `#f59e0b`; Warning: `#ef4444`
- Typography: Inter (body), JetBrains Mono (numbers/code)
- Card border-radius: `14px`; Button border-radius: `8px`
- Same sticky topbar, collapsible sidebar, drawer pattern as Finnable
- Persona color coding: CEO=gold, T&Q=violet, BM=blue, PM=teal, Analyst=red, Admin=white

---

## 10. Build Order (Phased)

### Phase 1 — Foundation (Week 1)
1. Create `cm_users` table in Shivamgiri
2. `src/callmaster/` folder structure, `processRegistry.ts`, `cmAuth.ts`
3. Auth routes (login, me)
4. `baseRepository.ts` + `unifiedKpiRepo.ts` (queries `v_call_master_unified_kpi`)
5. `public/callmaster/` shell: `index.html`, `design-system.css`, `app.js`, `components.js`, `charts.js`
6. Login screen + JWT decode + role-based sidebar + router
7. `mock.js` with all mock data factories

### Phase 2 — Core Personas (Week 2–3)
8. CEO persona: all 7 API endpoints + `ceo.js` frontend
9. T&Q Head persona: all 8 API endpoints + `tq.js` frontend
10. Process Manager — Shared pages (8 endpoints + `pm.js` core); Outbound wired to real DB from day 1
11. Process Manager — Inbound-only pages (4 endpoints: fatal-analysis, scenario-breakdown, detail-analysis, escalation-analysis); swap to live for Inbound db_audit
12. Process Manager — Outbound-only pages (5 endpoints: cst-crt-funnel, missed-opportunities, nps-csat, pitch-stage-analysis, objection-rebuttal)
13. Process Manager — Repeat Analysis page (1 endpoint) — implement after Looker screenshot review

### Phase 3 — Remaining Personas (Week 4)
12. Branch Manager persona: 6 endpoints + `bm.js`
13. Analyst persona: 6 endpoints + `analyst.js`
14. Admin panel: 6 endpoints + `admin.js`
15. Export routes (CSV per persona)
16. Chat + Email process integration (Phase 2 of project)

---

## 11. Looker Gap Resolution

The following gaps were identified by comparing the Looker dashboards (GNC Inbound + Birlanu MCN Outbound) against the original design. All are now incorporated.

### Inbound Gaps (resolved)

| Gap | Resolution |
|---|---|
| Quality band uses Hit/Watch/Miss | Corrected to Excellent/Good/Average/Below Average with Looker-matching thresholds |
| No configurable target line | `target_cq_pct` column in `process_mapping_master`; rendered as reference line on all score charts |
| No Fatal Analysis page | Added dedicated `fatal-analysis` endpoint + page |
| No Scenario dimension (Query/Complaint/Request/Sale Done) | Added as filter + dedicated `scenario-breakdown` page |
| No Detail Analysis with day/week breakdown | Added `detail-analysis` endpoint + page with TQ/MQ/BQ classification |
| Potential Escalation was thin | Expanded to 5 negative signals, social media threat, scam table, competitor section, detail panel |
| No ACHT call duration bucketing | Added to `process-overview` KPIs + Call Explorer filter |
| No Week×Scenario fatal cross-tab | Added to `fatal-analysis` page |
| TQ/MQ/BQ classification absent | Added to `analyst-scorecard` page + `detail-analysis` page |

### Outbound Gaps (resolved)

| Gap | Resolution |
|---|---|
| Single pitch funnel (no success/rejection tracks) | Replaced with CST/CRT dual-track funnel endpoint + page |
| No NPS/CSAT estimation | Added `nps-csat` endpoint + page (gauge + day-wise trend) |
| No Missed Opportunity Analysis | Added `missed-opportunities` endpoint + page with AI observations per MO category + NED/ED analysis |
| Pitch stage analysis not broken by stage | Added `pitch-stage-analysis` endpoint + page (OP, Context, Offered × Discount Type) |
| Objection tracked by category only, no rebuttal effectiveness | Added `objection-rebuttal` endpoint + page (failed/successful rebuttal%, conversion%) |
| No SCB/RCB (Success/Rejection Call Breakdown) | Added to CST/CRT Funnel page |

### Pending — Repeat Analysis (Inbound)

The **Repeat Analysis** page from the Inbound Looker dashboard has not yet been reviewed. Screenshot not available. Once reviewed, add as an additional Inbound-only PM page. Likely components based on context: repeat call count by reason, repeat caller identification, repeat rate % trend, repeat × agent/process cross-tab. Endpoint placeholder: `POST /api/callmaster/pm/repeat-analysis`.

---

## 12. Key Constraints

- `db_external` and `db_audit` are **read-only** — all writes (coaching, users, config) go to Shivamgiri
- Analyst role sees **own employee_code only** — all queries WHERE `agent_employee_code = :myCode`
- Branch Manager sees **own branch_short_name(s) only** — all queries WHERE `branch_short_name IN (:myBranches)`
- Process Manager sees **own process_name(s) only** — all queries WHERE `process_name IN (:myProcesses)`
- CEO and T&Q Head see **all data** — no branch/process WHERE clause applied
- `dashboard_exclusion_rules` applied on all unified KPI queries — inactive clients excluded automatically
- `USE_MOCK_DATA` in `mock.js` must be `true` on first deploy; flip per-process as DB access confirmed
