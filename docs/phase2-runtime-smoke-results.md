# Phase 2 Runtime Smoke Test Results

**Generated:** 2026-06-21T19:07:51.525Z
**Base URL:** http://localhost:5050
**Test User:** (SMOKE_BEARER_TOKEN)
**Date Range:** 2026-05-22 to 2026-06-21
**Auth Preflight:** ✅ PASS

**Data-Status Taxonomy:** NON_EMPTY = real data returned · SUPPORTED_FALSE = `{supported:false, reason:'…'}` (honest contract) · EMPTY = empty payload · SKIPPED = auth failed · ERROR = 5xx/network

---

## Summary

| Metric | Count |
|---|---|
| Total endpoints tested | 15 |
| ✅ Real data (LIVE) | 15 |
| ⚠ Supported-false (honest fallback) | 0 |
| ❌ Empty payload | 0 |
| 🔥 Error | 0 |
| ⏭ Skipped (auth failed) | 0 |
| **Problem total** | **0** |

## Per-Endpoint Results

| # | Endpoint | Method | HTTP | Success | Source | Data Status | Total ms |
|---|----------|--------|------|---------|--------|-------------|----------|
| 1 | /api/analytics/split-kpis | GET | 200 | true | finnable | ✅ Non-empty | 366 |
| 2 | /api/analytics/sales-intelligence | GET | 200 | true | finnable | ✅ Non-empty | 3 |
| 3 | /api/analytics/sales-funnel | GET | 200 | true | finnable | ✅ Non-empty | 1 |
| 4 | /api/analytics/leakage-report | GET | 200 | true | finnable | ✅ Non-empty | 2 |
| 5 | /api/analytics/risk-queue | GET | 200 | true | finnable | ✅ Non-empty | 77 |
| 6 | /api/analytics/tni-heatmap | GET | 200 | true | finnable | ✅ Non-empty | 137 |
| 7 | /api/analytics/drilldown | POST | 200 | true | finnable | ✅ Non-empty | 1 |
| 8 | /api/analytics/compliance-summary | GET | 200 | true | finnable | ✅ Non-empty | 3 |
| 9 | /api/analytics/journey-summary | GET | 200 | true | finnable | ✅ Non-empty | 4 |
| 10 | /api/analytics/quality-distribution | GET | 200 | true | finnable | ✅ Non-empty | 23 |
| 11 | /api/analytics/top-bottom-agents | GET | 200 | true | finnable | ✅ Non-empty | 5 |
| 12 | /api/analytics/sensitive-words | GET | 200 | true | finnable | ✅ Non-empty | 114 |
| 13 | /api/analytics/risk-by-process | GET | 200 | true | finnable | ✅ Non-empty | 4 |
| 14 | /api/analytics/analyst-daily-trend | GET | 200 | true | finnable | ✅ Non-empty | 143 |
| 15 | /api/analytics/parameter-trend | GET | 200 | true | finnable | ✅ Non-empty | 16 |

## Detailed Results

### 1. GET /api/analytics/split-kpis

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 366

### 2. GET /api/analytics/sales-intelligence

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 3

### 3. GET /api/analytics/sales-funnel

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 1

### 4. GET /api/analytics/leakage-report

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 2

### 5. GET /api/analytics/risk-queue

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 77

### 6. GET /api/analytics/tni-heatmap

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 137

### 7. POST /api/analytics/drilldown

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 1

### 8. GET /api/analytics/compliance-summary

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 3

### 9. GET /api/analytics/journey-summary

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 4

### 10. GET /api/analytics/quality-distribution

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 23

### 11. GET /api/analytics/top-bottom-agents

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 5

### 12. GET /api/analytics/sensitive-words

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 114

### 13. GET /api/analytics/risk-by-process

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 4

### 14. GET /api/analytics/analyst-daily-trend

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 143

### 15. GET /api/analytics/parameter-trend

- **Status:** 200
- **HTTP OK:** ✅
- **Data Status:** NON_EMPTY
- **Success:** true
- **Source:** finnable
- **From:** 2026-05-22
- **To:** 2026-06-21
- **Total ms:** 16

