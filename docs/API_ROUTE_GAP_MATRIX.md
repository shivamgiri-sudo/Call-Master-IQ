# API Route Gap Matrix — Phase 2 Analytics Extension

**Scope:** All 15 endpoints mounted under `/api/analytics` via `src/routes/analyticsExtension.ts`.
**Routing chain:** `server.ts:64-65` mounts `analyticsRoutes` then `analyticsExtensionRoutes` at `/api/analytics`. No path collisions; route ordering is stable.
**Auth chain (per route):** `jwtAuth` → `loadUserScope` (RBAC scope filter) → controller → service.
**Standard envelope (success):**

```json
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "meta": {
    "source": "finnable | generic",
    "cacheHit": false,
    "queryMs": 0,
    "totalMs": 0,
    "from": "YYYY-MM-DD",
    "to": "YYYY-MM-DD"
  }
}
```

**Standard envelope (error):**

```json
{
  "success": false,
  "code": "DATE_RANGE_EXCEEDED | INVALID_DATE_FORMAT | INVALID_DATE_RANGE | INTERNAL_ERROR | …",
  "message": "human-readable"
}
```

**Status legend:**

| Status | Meaning |
|---|---|
| ✅ LIVE | Real data returned via SQL aggregation / engine computation. |
| ⚠ LIVE-FINNABLE | Real data for Finnable adapter (`client_id=497`); `supported:false` for generic adapter — honest contract. |
| ⚠ SUPPORTED_FALSE | Endpoint correctly returns `{ supported: false, reason: '…' }`. Not a stub. |
| ❌ STUB | Endpoint exists in routing but returns hardcoded "Endpoint not yet implemented". **Must be 0.** |
| 🚧 PARTIAL | Endpoint returns data, but the structure is incomplete or mis-named for the route's contract. |

---

## Endpoint-by-endpoint matrix

| # | Method | Path | Source adapter | Status | Source columns / view | Code location | Notes |
|---|---|---|---|---|---|---|---|
| 1 | GET  | `/api/analytics/split-kpis` | Finnable | ✅ LIVE | `db_external.CallDetails` (SUMMARY_COLUMNS) → `analyticsEngine.buildSummary/buildSales/buildQuality/buildCompliance` | `analyticsExtensionService.ts:getSplitKPIs` | Returns totalCalls, avgQuality, sales/mixed/support avg, opportunities, pitch metrics, risk buckets, sales funnel, quality bands. |
| 1 | GET  | `/api/analytics/split-kpis` | Generic | ✅ LIVE | `v_call_master_unified_kpi` (COUNT/AVG/COUNT-conditional) | `analyticsExtensionService.ts:getSplitKPIs` | Returns totalCalls, qualityScoredCalls, avgQuality, criticalCalls. |
| 2 | GET  | `/api/analytics/sales-intelligence` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildSales` | `getSalesIntelligence` | Returns funnel, pitchStrength, leakage, pricing, objections, themes. |
| 2 | GET  | `/api/analytics/sales-intelligence` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getSalesIntelligence` | `reason: 'Sales intelligence requires Finnable adapter'` |
| 3 | GET  | `/api/analytics/sales-funnel` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildSalesFunnel` | `getSalesFunnel` | Returns `{ source:'finnable', stages[], totalOpportunities }`. **Fixed in Phase 2 Task 3 closure** — was previously a thin alias of sales-intelligence. |
| 3 | GET  | `/api/analytics/sales-funnel` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getSalesFunnel` | `reason: 'FUNNEL_COLUMNS_NOT_AVAILABLE'` |
| 4 | GET  | `/api/analytics/leakage-report` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildSales` (subset: leakage, pricing, objections) | `getLeakageReport` | Real. |
| 4 | GET  | `/api/analytics/leakage-report` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getLeakageReport` | `reason: '…'` (generic has no leakage taxonomy). |
| 5 | GET  | `/api/analytics/risk-queue` | Finnable | ✅ LIVE | `db_external.CallDetails` (RISK_COLUMNS, filtered to `Snapmint_Pitch IN ('High','Critical','Medium')`) → `enrichRows` → `lightRecord` | `getRiskQueue` | Paginated (page, limit, default 50, cap 100). |
| 5 | GET  | `/api/analytics/risk-queue` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getRiskQueue` | `reason: '…'` |
| 6 | GET  | `/api/analytics/tni-heatmap` | Finnable | ✅ LIVE | `db_external.CallDetails` (TNI_COLUMNS) → `tniEngine.buildParameterHeatmap/buildTNI/buildProcessTNI` | `getTNIHeatmap` | Returns heatmap + tni + processTNI. |
| 6 | GET  | `/api/analytics/tni-heatmap` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getTNIHeatmap` | `reason: '…'` (TNI parameter columns not available). |
| 7 | POST | `/api/analytics/drilldown` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.insightMatches` (filter) → `lightRecord` | `getDrilldown` | Paginated, dimension/value in body. |
| 7 | POST | `/api/analytics/drilldown` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getDrilldown` | `reason: '…'` |
| 8 | GET  | `/api/analytics/compliance-summary` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildCompliance` | `getComplianceSummary` | Returns buckets + highPriority/medium/evidenceQueue. |
| 8 | GET  | `/api/analytics/compliance-summary` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getComplianceSummary` | `reason: '…'` |
| 9 | GET  | `/api/analytics/journey-summary` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildJourney` | `getJourneySummary` | Returns callTypes, stages, supportStatuses, pendingCalls. |
| 9 | GET  | `/api/analytics/journey-summary` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getJourneySummary` | `reason: '…'` |
| 10 | GET  | `/api/analytics/quality-distribution` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildQuality` | `getQualityDistribution` | Returns bands, byCallType, parameters. |
| 10 | GET  | `/api/analytics/quality-distribution` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getQualityDistribution` | `reason: '…'` |
| 11 | GET  | `/api/analytics/top-bottom-agents` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildAnalysts` (sorted by avgQuality) | `getTopBottomAgents` | Paginated (default 20, cap 100). |
| 11 | GET  | `/api/analytics/top-bottom-agents` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getTopBottomAgents` | `reason: '…'` |
| 12 | GET  | `/api/analytics/sensitive-words` | Finnable | ✅ LIVE | `db_external.CallDetails` (SensitiveWordUsed, SensitiveWordContext, TopNegativeWordsByAgent, TopNegativeWordsByCustomer) → `sensitiveWordsEngine.buildSensitiveWordsSummary` | `getSensitiveWords` | **Implemented Phase 2 Task 3 closure.** Returns totalRows, totalIncidents, byTerm, byAgent, byCustomerTerm, recentContexts (masked). |
| 12 | GET  | `/api/analytics/sensitive-words` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getSensitiveWords` | `reason: 'SENSITIVE_WORD_COLUMNS_NOT_AVAILABLE'` (no sensitive-word columns in unified view). |
| 13 | GET  | `/api/analytics/risk-by-process` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildRiskByProcess` (grouped by `Category`, aggregated riskBucket + qualityBand) | `getRiskByProcess` | **Implemented Phase 2 Task 3 closure.** Returns `{dimension:'category', rows[]}`. |
| 13 | GET  | `/api/analytics/risk-by-process` | Generic | ✅ LIVE | `v_call_master_unified_kpi` GROUP BY `process_name` (is_critical_call, alert_severity, quality_band) | `getRiskByProcess` | **Implemented Phase 2 Task 3 closure.** Real SQL, not a stub. Returns `{dimension:'process_name', rows[]}`. |
| 14 | GET  | `/api/analytics/analyst-daily-trend` | Finnable | ✅ LIVE | `db_external.CallDetails` (TREND_COLUMNS) → `trendEngine.buildDayTrend` | `getAnalystDailyTrend` | Returns `{trend: DayTrendItem[]}`. |
| 14 | GET  | `/api/analytics/analyst-daily-trend` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getAnalystDailyTrend` | `reason: '…'` |
| 15 | GET  | `/api/analytics/parameter-trend` | Finnable | ✅ LIVE | enriched rows → `analyticsEngine.buildParameterTrend` (8 parameters, day-by-day pass-rate) | `getParameterTrend` | **Implemented Phase 2 Task 3 closure.** Returns `{source:'finnable', parameters[], trend[], daysCovered}`. |
| 15 | GET  | `/api/analytics/parameter-trend` | Generic | ⚠ SUPPORTED_FALSE | n/a | `getParameterTrend` | `reason: 'GENERIC_PARAMETER_COLUMNS_NOT_AVAILABLE'` (verified — unified view exposes no parameter columns). |

---

## Status summary

| Status | Count (adapter-agnostic) |
|---|---:|
| ✅ LIVE | 11 (split-kpis counted once — both adapters live) |
| ⚠ LIVE-FINNABLE / UNSUPPORTED-GENERIC | 3 (sensitive-words, parameter-trend; sales-intelligence/funnel/leakage/risk-queue/tni-heatmap/drilldown/compliance-summary/journey-summary/quality-distribution/top-bottom-agents/analyst-daily-trend all return `supported:false` for generic — same pattern, listed separately above) |
| ⚠ SUPPORTED_FALSE | All generic-fallback responses (intentional contract) |
| ❌ STUB | **0** |
| 🚧 PARTIAL | 0 (sales-funnel fixed in this cycle — now a real stage-by-stage structure) |

**Total endpoint × adapter rows: 30** (15 endpoints × 2 adapters — `risk-by-process` and `split-kpis` are LIVE on both adapters; the rest are LIVE-Finnable / SUPPORTED_FALSE-generic).

---

## Cross-cutting invariants

| Check | Where | Evidence |
|---|---|---|
| All 15 routes mounted at `/api/analytics` | `server.ts:64-65`, `routes/analyticsExtension.ts:21-36` | route file walk |
| All 15 use `jwtAuth` | `routes/analyticsExtension.ts:16` (`router.use(jwtAuth)`) | applies to all |
| All 15 use `loadUserScope` (RBAC) | `routes/analyticsExtension.ts:17` | applies to all |
| Standard success envelope | `analyticsExtensionService.ts:buildResponseEnvelope` | `success:true, data, meta{source,cacheHit,queryMs,totalMs,from,to}` |
| Standard error envelope `{code,message}` | `analyticsExtensionController.ts:handleError` | commit `53cb3b5` history |
| No raw 500 | `analyticsExtensionController.ts:12-22` | every thrown error mapped to code+message |
| Date range validation | `analyticsExtensionService.ts:validateDateRange` | throws `DATE_RANGE_EXCEEDED` / `INVALID_DATE_FORMAT` / `INVALID_DATE_RANGE` |
| Pagination cap | `analyticsExtensionService.ts` (multiple) | `Math.min(100, Math.max(10, …))` |
| Read-only on `db_external` | `finnable/repository.ts:assertSelectOnly` | grep + runtime |
| No `db_audit` writes | no `dbAuditPool` references in `finnable/` | grep |
| Mobile masking | `finnable/mapper.ts:maskMobile` | last-4 digits only |
| Transcript masking | `finnable/mapper.ts:maskTranscript` | phone-numbers + OTP/PIN/CVV digits |
| JWT not logged | `scripts/phase2-smoke.ts:acquireToken` | sanitized error logs |

---

## Honesty notes (read these before claiming MVP done)

1. **`risk-by-process` is LIVE on BOTH adapters** — Finnable path groups by `Category` (no `process_name` column in CallDetails), generic path groups by `process_name` (real column from unified view). The dimension is reported in the response (`dimension: 'category' | 'process_name'`) so consumers can distinguish.

2. **`/parameter-trend` generic is genuinely SUPPORTED_FALSE** — not laziness. The unified view in `src/config/phase2_tables.sql:121-140` exposes `quality_score / total_score / max_score / quality_band / is_critical_call / alert_severity / call_date / process_name / business_lob / branch_short_name / agent_*` but **no** per-parameter columns. Adding parameter columns to the unified view would require migrating parameter data into Shivamgiri — that is a Phase-3 decision, not a Phase-2 fix.

3. **`/sensitive-words` generic is SUPPORTED_FALSE for the same reason** — `SensitiveWordUsed`, `SensitiveWordContext`, `TopNegativeWordsByAgent`, `TopNegativeWordsByCustomer` exist only in `db_external.CallDetails`.

4. **`/sales-funnel` was previously mis-named** — it returned the entire `buildSales` object instead of a stage-by-stage funnel with conversion rates. Fixed in this cycle. Now returns `{ stages: [{stage, count, conversionRateFromPrevious}], totalOpportunities }`. The generic path is SUPPORTED_FALSE with reason `FUNNEL_COLUMNS_NOT_AVAILABLE` — same data-model limitation.

5. **Smoke-output contract change.** The smoke script (`scripts/phase2-smoke.ts`) now classifies responses into 5 buckets: `NON_EMPTY`, `SUPPORTED_FALSE`, `EMPTY`, `SKIPPED`, `ERROR`. The previous version collapsed `supported:false` into "non-empty pass", which masked stub responses. The new version reports each contract-compliant `supported:false` separately with the reason field. This is enforced in the script itself, not in user code.

6. **No endpoint was claimed LIVE without runtime evidence.** "Runtime evidence" means a successful smoke pass with the source adapter that produces real data. The smoke run is operator-replayable via `docs/MVP_FINAL_VALIDATION_RUNBOOK.md`.