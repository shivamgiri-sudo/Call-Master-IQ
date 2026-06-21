# MVP Final Validation Runbook — Call Master Enterprise IQ

**Purpose:** Operator-executable sequence that proves the 15 Phase 2 analytics endpoints, the Finnable + generic adapter boundary, and the read-only security invariants are all green **at runtime**, on a fresh checkout, against the live MySQL source.

**Status taxonomy (used by `phase2:smoke` and this runbook):**

| Status | Meaning |
|---|---|
| ✅ LIVE | Endpoint returned real data — counts, lists, structures backed by queries against `db_external` or `v_call_master_unified_kpi`. |
| ⚠ LIVE-FINNABLE / UNSUPPORTED-GENERIC | Endpoint is implemented for the Finnable adapter (client_id `497`); generic adapter returns `{ supported: false, reason: '…' }`. This is a **contract**, not a stub. |
| ⚠ SUPPORTED_FALSE | Endpoint correctly reports `supported:false` with explicit reason. The `supported:false` path is now classified separately from real data in smoke output. |
| ❌ STUB | Endpoint exists in routing only and returns hardcoded `{ supported: false, reason: 'Endpoint not yet implemented' }`. **None should remain after Block A.** |
| ⏭ SKIPPED | Auth preflight failed; endpoint was not exercised. |

> **No LIVE marking without runtime evidence.** This runbook exists so any operator can regenerate the evidence and confirm.

---

## 0. Prerequisites

- Node.js 22.x (tested on 22.17.0)
- npm 10.x (tested on 10.9.2)
- Network access to the MySQL host (`DB_HOST`, default `192.168.10.6:3306`)
- A valid `.env` file at the repo root containing at minimum:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
  - `DB_NAME=Shivamgiri`
  - `DB_AUDIT_NAME=db_audit`
  - `DB_EXTERNAL_NAME=db_external`
  - `JWT_SECRET` (≥ 32 chars)
  - `JWT_EXPIRES_IN=8h`
  - `SMOKE_ADMIN_LOGIN_ID` and `SMOKE_ADMIN_PASSWORD` (qa-auth account)
- Read-only user permissions on `db_external` and `db_audit`
- Read/write permissions on the `Shivamgiri` primary database

> **Never commit `.env`.** The strengthened `.gitignore` includes `**/.env` to catch any nested variants.

---

## 1. Setup

```bash
git clone https://github.com/shivamgiri-sudo/Call-Master-IQ.git
cd Call-Master-IQ
git checkout feature/mvp-final-validation-and-frontend   # branch containing the MVP-final work
npm install
```

---

## 2. Static checks (no DB needed)

```bash
# TypeScript — must exit 0
npx tsc --noEmit

# Production build — must exit 0
npm run build
```

**Pass criteria:** Both commands exit `0` with zero diagnostics.

---

## 3. Migration safety — Phase 1 dry-run

```bash
npm run migrate:phase1:dry-run
```

**Pass criteria:**
- Exit `0`
- Lists all 11 Phase 1 SQL files
- Issues zero SQL statements (dry-run only)

The Phase 4 dry-run is run for parity:

```bash
npm run migrate:phase4:dry-run
```

---

## 4. Column verification — DB-side evidence

```bash
npm run phase2:describe
```

This writes `docs/phase2-column-verification.md`. The script connects to MySQL and runs `DESCRIBE` against:

- `Shivamgiri.v_call_master_unified_kpi`
- `Shivamgiri.v_call_master_inbound_kpi`
- `Shivamgiri.v_call_master_outbound_kpi`
- `db_external.CallDetails`

**Pass criteria:**
- All 4 tables reachable
- File written
- The column list matches the expectations documented in §6 below

---

## 5. Runtime evidence — boot server

In terminal A:

```bash
npm run dev
```

Wait for `LexicalSpark API running on port 5050`. The server should bind without DB connection errors (DB is lazy-initialised per request).

---

## 6. Read-only invariant — db_external repository

The Finnable repository (`src/services/finnable/repository.ts`) runs `assertSelectOnly()` on every SQL string before execution. Any non-SELECT keyword throws `READONLY_DB_VIOLATION`.

To prove the invariant with a static check:

```bash
# No INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE/REPLACE/CREATE in the repository
grep -nE '\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|REPLACE|CREATE)\b' \
  src/services/finnable/repository.ts || echo "OK: zero write statements"
```

**Pass criteria:** Output is `OK: zero write statements`.

To prove `db_audit` is untouched by Finnable:

```bash
grep -nE 'db_audit|dbAuditPool' src/services/finnable/ || echo "OK: zero db_audit references"
```

---

## 7. Date range rejection — 400 contract

The `validateDateRange()` helper throws structured errors mapped by the controller to HTTP 400 with the standard envelope. To exercise:

```bash
# After auth, hit any analytics endpoint with a > 90-day range (ANALYTICS_MAX_DATE_RANGE_DAYS)
TOKEN="<paste token from /api/qa-auth/login>"
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5050/api/analytics/split-kpis?client_id=497&from=2020-01-01&to=2026-12-31" | head
```

**Pass criteria:** Response is HTTP `400` with body `{ "success": false, "code": "DATE_RANGE_EXCEEDED", "message": "Date range exceeds maximum allowed days" }`.

---

## 8. Cache evidence — first vs second request

```bash
# First request — cacheHit should be false
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5050/api/analytics/split-kpis?client_id=497&from=$(date -d '7 days ago' +%Y-%m-%d)&to=$(date +%Y-%m-%d)" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('cacheHit:', d['meta']['cacheHit'])"

# Second request within TTL (15s default) — cacheHit should be true
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5050/api/analytics/split-kpis?client_id=497&from=$(date -d '7 days ago' +%Y-%m-%d)&to=$(date +%Y-%m-%d)" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('cacheHit:', d['meta']['cacheHit'])"
```

**Pass criteria:**
- First print: `cacheHit: False`
- Second print (within 15s): `cacheHit: True`

---

## 9. 15-endpoint smoke

In terminal B (server still running in terminal A):

```bash
npm run phase2:smoke
```

**Pass criteria:**
- Exit code `0` (or non-zero only if any ERROR/non-2xx occurred)
- `docs/phase2-runtime-smoke-results.md` is written
- **Zero** endpoints classified as `❌ STUB` or returning literal `{ supported: false, reason: 'Endpoint not yet implemented' }`
- Per-endpoint status matches the **API Route Gap Matrix** (`docs/API_ROUTE_GAP_MATRIX.md`)

After the Phase 2 Task 3 closure (Block A), the expected distribution for the 15-endpoint set with `client_id=497` is:

| Status | Expected count | Endpoints |
|---|---:|---|
| ✅ LIVE | 11 | split-kpis (both adapters), sales-intelligence, sales-funnel, leakage-report, risk-queue, tni-heatmap, drilldown, compliance-summary, journey-summary, quality-distribution, top-bottom-agents, analyst-daily-trend (note: 12 with split-kpis counted as 2 — see matrix for exact split) |
| ⚠ LIVE-FINNABLE | 3 | sensitive-words, risk-by-process, parameter-trend (Finnable path returns real data; generic returns `supported:false`) |
| ⚠ SUPPORTED_FALSE | 3 | same 3, when called via generic adapter |
| ❌ STUB | 0 | — |

---

## 10. No-raw-500 invariant

The `handleError()` helper in `src/controllers/analyticsExtensionController.ts` maps every thrown error to a structured `{ success: false, code, message }` envelope with HTTP 500 only as a fallback. Smoke run will not encounter a raw 500 unless an unexpected exception path is hit.

**Pass criteria:** Smoke report shows zero `ERROR` rows.

---

## 11. No-secret-in-logs invariant

```bash
# Search for any committed file that contains DB password or JWT secret patterns
grep -rE "(password\s*=\s*['\"][^'\"]{4,}|JWT_SECRET\s*=\s*[A-Za-z0-9]{16,})" \
  --include="*.ts" --include="*.js" --include="*.md" --include="*.sql" \
  --include="*.json" --exclude-dir=node_modules --exclude-dir=dist . || echo "OK: no plaintext secrets in tracked files"
```

**Pass criteria:** `OK: no plaintext secrets in tracked files`.

> **Note:** Git history may still contain a now-redacted `folder/path/.env` (see `docs/MERGE_DECISION_LOG.md` and `Block C` in this validation cycle). That is a separate, tracked issue — see `docs/HISTORY_PURGE_PLAN.md` for the remediation plan.

---

## 12. Final go / no-go table

| Gate | Command | Pass criterion | Status |
|---|---|---|---|
| Setup | `npm install` | Exit 0 | ☐ |
| Typecheck | `npx tsc --noEmit` | Exit 0 | ☐ |
| Build | `npm run build` | Exit 0 | ☐ |
| Migration dry-run | `npm run migrate:phase1:dry-run` | Exit 0, 11 files listed | ☐ |
| Column verification | `npm run phase2:describe` | `docs/phase2-column-verification.md` written | ☐ |
| Read-only invariant | grep Finnable repo | Zero write statements | ☐ |
| Date range rejection | curl 90-day span | HTTP 400 with `code: DATE_RANGE_EXCEEDED` | ☐ |
| Cache evidence | double-curl within 15s | First `cacheHit:false`, second `cacheHit:true` | ☐ |
| 15-endpoint smoke | `npm run phase2:smoke` | All routes 2xx, no STUB, evidence written | ☐ |
| No-raw-500 | smoke output | Zero ERROR rows | ☐ |
| No-secret-logs | grep tracked files | No plaintext secrets | ☐ |

**MVP GO iff every gate is ✅.**

---

## 13. Post-MVP follow-up (out of scope for this runbook)

- **History purge of `folder/path/.env`** — see `docs/HISTORY_PURGE_PLAN.md`. **Decision is pending DB password + JWT secret rotation by the operator.**
- **Frontend MVP pages** — gated on backend go/no-go above being ✅.
- **Phase 4 (AI providers)** — separate runbook.
- **Export endpoints** — `src/callmaster/routes/exportRoutes.ts` already exists; export-button UI placeholder only until export backend is wired.
