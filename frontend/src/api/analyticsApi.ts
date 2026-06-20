/**
 * analyticsApi — typed wrappers for all 15 Phase 2 analytics endpoints.
 *
 * Contract reminder (see docs/API_ROUTE_GAP_MATRIX.md):
 *   - All routes under /api/analytics
 *   - All require jwtAuth + loadUserScope (server-side enforcement)
 *   - Success envelope: { success: true, data, meta }
 *   - Error envelope:   { success: false, code, message }
 *   - supported:false is a contract for endpoints whose generic view lacks the
 *     required columns — UI must show "Not available for this process".
 */

import { http } from './httpClient';
import type {
  SplitKpisData,
  SalesIntelligenceData,
  SalesFunnelData,
  LeakageReportData,
  RiskQueueData,
  TniHeatmapData,
  DrilldownData,
  ComplianceSummaryData,
  JourneySummaryData,
  QualityDistributionData,
  TopBottomAgentsData,
  SensitiveWordsData,
  RiskByProcessData,
  AnalystDailyTrendData,
  ParameterTrendData,
  DrilldownPayload,
} from './types';

export interface AnalyticsFilters {
  client_id?: string;
  process_name?: string;
  business_lob?: string;
  branch_short_name?: string;
  source_type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  // Index signature keeps AnalyticsFilters assignable to the query-bag
  // type accepted by httpClient without breaking the explicit named fields.
  [key: string]: string | number | undefined | null;
}

// ─── 1. split-kpis ─────────────────────────────────────────────────────────
export const getSplitKpis = (f: AnalyticsFilters) =>
  http.get<SplitKpisData>('/api/analytics/split-kpis', f);

// ─── 2. sales-intelligence ──────────────────────────────────────────────────
export const getSalesIntelligence = (f: AnalyticsFilters) =>
  http.get<SalesIntelligenceData>('/api/analytics/sales-intelligence', f);

// ─── 3. sales-funnel ───────────────────────────────────────────────────────
export const getSalesFunnel = (f: AnalyticsFilters) =>
  http.get<SalesFunnelData>('/api/analytics/sales-funnel', f);

// ─── 4. leakage-report ──────────────────────────────────────────────────────
export const getLeakageReport = (f: AnalyticsFilters) =>
  http.get<LeakageReportData>('/api/analytics/leakage-report', f);

// ─── 5. risk-queue ─────────────────────────────────────────────────────────
export const getRiskQueue = (f: AnalyticsFilters) =>
  http.get<RiskQueueData>('/api/analytics/risk-queue', f);

// ─── 6. tni-heatmap ────────────────────────────────────────────────────────
export const getTniHeatmap = (f: AnalyticsFilters) =>
  http.get<TniHeatmapData>('/api/analytics/tni-heatmap', f);

// ─── 7. drilldown (POST) ───────────────────────────────────────────────────
export const postDrilldown = (body: DrilldownPayload) =>
  http.post<DrilldownData>('/api/analytics/drilldown', body);

// ─── 8. compliance-summary ──────────────────────────────────────────────────
export const getComplianceSummary = (f: AnalyticsFilters) =>
  http.get<ComplianceSummaryData>('/api/analytics/compliance-summary', f);

// ─── 9. journey-summary ─────────────────────────────────────────────────────
export const getJourneySummary = (f: AnalyticsFilters) =>
  http.get<JourneySummaryData>('/api/analytics/journey-summary', f);

// ─── 10. quality-distribution ───────────────────────────────────────────────
export const getQualityDistribution = (f: AnalyticsFilters) =>
  http.get<QualityDistributionData>('/api/analytics/quality-distribution', f);

// ─── 11. top-bottom-agents ──────────────────────────────────────────────────
export const getTopBottomAgents = (f: AnalyticsFilters) =>
  http.get<TopBottomAgentsData>('/api/analytics/top-bottom-agents', f);

// ─── 12. sensitive-words ────────────────────────────────────────────────────
export const getSensitiveWords = (f: AnalyticsFilters) =>
  http.get<SensitiveWordsData>('/api/analytics/sensitive-words', f);

// ─── 13. risk-by-process ────────────────────────────────────────────────────
export const getRiskByProcess = (f: AnalyticsFilters) =>
  http.get<RiskByProcessData>('/api/analytics/risk-by-process', f);

// ─── 14. analyst-daily-trend ─────────────────────────────────────────────────
export const getAnalystDailyTrend = (f: AnalyticsFilters) =>
  http.get<AnalystDailyTrendData>('/api/analytics/analyst-daily-trend', f);

// ─── 15. parameter-trend ────────────────────────────────────────────────────
export const getParameterTrend = (f: AnalyticsFilters) =>
  http.get<ParameterTrendData>('/api/analytics/parameter-trend', f);