# Demo Runbook

Project name: Call Master Enterprise IQ

Status: locally validated, not public released.

Branch: `feature/mvp-final-validation-and-frontend`

Latest commit before final docs commit: `171de26`

## Start Commands

Backend:

```bash
cd ~/Call-Master-IQ
npm run dev
```

Frontend:

```bash
cd ~/Call-Master-IQ/frontend
npm run dev
```

Backend URL: `http://localhost:5050`

Frontend URL: `http://localhost:5173`

## Login Flow

Open the frontend URL, sign in through the Call Master IQ login page, and verify the operator lands on the role-appropriate default route. Do not display, copy, or log credentials, tokens, or authorization headers during the demo.

## Demo Route Order

1. Login
2. Executive Command Center
3. Quality Intelligence
4. Sales Funnel Intelligence
5. Risk & Compliance Queue
6. Analyst Performance + Analyst Detail Panel
7. Evidence Drilldown
8. Admin Panel + Readiness Center
9. Profile + Role-based access
10. Settings / Filters

## Demo Notes

- Use the global filters to show date range, client, process, branch, source type, and active chips.
- Open a risk/evidence row to show masked evidence only.
- Open Analyst Performance, select an analyst, and show summary, trend, evidence, and coaching recommendations.
- Open Admin Panel to show read-only user/role management and readiness status.
- Use copy/export actions only for sanitized summaries or visible safe table fields.

## Known Blockers

- Audit advisories pending.
- Previously exposed secrets still require rotation.
- Git history cleanup pending.
- Public push not approved.
- Public release not approved.
- Admin APIs are read-only; role/status mutation is not enabled.

## Release Notice

Do not push or publicly release from this branch until the operator explicitly approves the push strategy and security cleanup plan.

