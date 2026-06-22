# Final Handover Notes

Project: Call Master Enterprise IQ

Status: locally validated, not public released.

Branch: `feature/mvp-final-validation-and-frontend`

## What Is Complete

- Backend analytics validation endpoints.
- Frontend enterprise dashboard experience.
- Role-based route access and default landing behavior.
- Executive Command Center.
- Quality Intelligence.
- Sales Funnel Intelligence.
- Risk & Compliance Queue.
- Analyst Performance with analyst detail panel.
- Evidence Drilldown with masked evidence.
- Admin Panel with read-only user, role, permission, and readiness views.
- Profile and Settings/Filters pages.
- Copy-safe summaries and visible-table CSV export.
- Release readiness documentation.

## What Is Validated

- Backend TypeScript and build.
- Frontend TypeScript and build.
- Database column verification.
- Runtime smoke for 15 analytics endpoints.
- Read-only admin APIs.
- Analyst summary, trend, evidence, and coaching APIs.
- RBAC/auth routing.
- Evidence masking and safe exports.

## How To Run Backend

```bash
cd ~/Call-Master-IQ
npm run dev
```

Backend URL: `http://localhost:5050`

## How To Run Frontend

```bash
cd ~/Call-Master-IQ/frontend
npm run dev
```

Frontend URL: `http://localhost:5173`

## APIs That Exist

Analytics:

- `GET /api/analytics/filter-options`
- `GET /api/analytics/split-kpis`
- `GET /api/analytics/sales-intelligence`
- `GET /api/analytics/sales-funnel`
- `GET /api/analytics/leakage-report`
- `GET /api/analytics/risk-queue`
- `GET /api/analytics/tni-heatmap`
- `POST /api/analytics/drilldown`
- `GET /api/analytics/compliance-summary`
- `GET /api/analytics/journey-summary`
- `GET /api/analytics/quality-distribution`
- `GET /api/analytics/top-bottom-agents`
- `GET /api/analytics/sensitive-words`
- `GET /api/analytics/risk-by-process`
- `GET /api/analytics/analyst-daily-trend`
- `GET /api/analytics/parameter-trend`

Analyst detail:

- `GET /api/analytics/analysts/:analystId/summary`
- `GET /api/analytics/analysts/:analystId/trend`
- `GET /api/analytics/analysts/:analystId/evidence`
- `GET /api/analytics/analysts/:analystId/coaching`

Admin read-only:

- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `GET /api/admin/roles`
- `GET /api/admin/permissions`
- `GET /api/admin/role-matrix`

## Roles That Exist

- `SUPER_ADMIN`
- `CEO`
- `HO_QA`
- `HO_OPERATIONS`
- `QUALITY_MANAGER`
- `OPERATIONS_MANAGER`
- `PROCESS_MANAGER`
- `BRANCH_MANAGER`
- `TEAM_LEADER`
- `QUALITY_ANALYST`
- `TRAINER`
- `HR_ADMIN`
- `PAYROLL_ADMIN`
- `ANALYST`
- `VIEWER`

## Pages That Exist

- Login
- Executive Command Center
- Quality Intelligence
- Sales Funnel Intelligence
- Risk & Compliance Queue
- TNI Coaching Heatmap
- Analyst Performance
- Evidence Drilldown
- Admin Panel
- Profile
- Settings / Filters
- Unauthorized

## What Is Intentionally Blocked

- Public release.
- Push to remote.
- History purge.
- Destructive admin user operations.
- Role/status mutation APIs.
- Raw transcript display or export.
- Password, token, hash, or secret display.

## Required Before Public Release

- Operator approval for push strategy.
- Rotate previously exposed secrets.
- Decide and execute history cleanup plan if approved.
- Review audit advisories.
- Re-run final validation after any secret rotation or environment change.
- Confirm production environment variables without printing secret values.

