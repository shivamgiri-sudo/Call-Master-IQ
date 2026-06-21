/**
 * API types — mirror of backend envelope contracts.
 * See:
 *   src/services/finnable/* (engine shapes)
 *   src/services/analyticsExtensionService.ts (route handlers)
 *   docs/API_ROUTE_GAP_MATRIX.md (status taxonomy)
 */

// ─── Standard envelope ──────────────────────────────────────────────────────

export type AdapterSource = 'finnable' | 'generic';

export interface MetaEnvelope {
  source: AdapterSource;
  cacheHit: boolean;
  queryMs: number;
  totalMs: number;
  from: string;
  to: string;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: MetaEnvelope;
}

export interface ErrorEnvelope {
  success: false;
  code: string;
  message: string;
}

export type ApiResponse<T> = SuccessEnvelope<T> | ErrorEnvelope;

// ─── API client discriminated result ────────────────────────────────────────

export interface ApiOk<T> {
  kind: 'ok';
  data: T;
  meta: MetaEnvelope;
}

export interface ApiUnsupported {
  kind: 'unsupported';
  reason: string;
}

export interface ApiEmpty {
  kind: 'empty';
  meta: MetaEnvelope;
}

export interface ApiError {
  kind: 'error';
  status: number;
  code?: string;
  message: string;
  retryable: boolean;
}

export type ApiResult<T> = ApiOk<T> | ApiUnsupported | ApiEmpty | ApiError;

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterOptionsData {
  clients: FilterOption[];
  processes: FilterOption[];
  businessLobs: FilterOption[];
  branches: FilterOption[];
  sources: FilterOption[];
  defaults: {
    client_id: string;
  };
}

// ─── Domain types (subset; full shape inferred from usage) ──────────────────

export interface CountItem {
  label: string;
  count: number;
}

export interface SplitKpisData {
  totalCalls?: number;
  qualityScoredCalls?: number;
  avgQuality?: number;
  salesMixedAvgQuality?: number;
  supportAvgQuality?: number;
  opportunities?: number;
  pitched?: number;
  strongPitch?: number;
  highRiskTriggers?: number;
  mediumFlags?: number;
  disbursalSignal?: number;
  qualityBands?: CountItem[];
  riskBuckets?: CountItem[];
  salesFunnel?: CountItem[];
}

export interface SalesIntelligenceData {
  funnel?: CountItem[];
  pitchStrength?: CountItem[];
  leakage?: CountItem[];
  pricing?: CountItem[];
  objections?: CountItem[];
  themes?: Array<{
    label: string;
    count: number;
    avgQuality: number;
    progressionRate: number;
    riskCount: number;
  }>;
}

export interface SalesFunnelStage {
  stage: string;
  count: number;
  conversionRateFromPrevious: number | null;
}

export interface SalesFunnelData {
  source: 'finnable';
  stages: SalesFunnelStage[];
  totalOpportunities: number;
}

export interface LeakageReportData {
  leakage?: CountItem[];
  pricing?: CountItem[];
  objections?: CountItem[];
}

export interface RiskQueueRecord {
  id: string;
  date: string;
  analyst: string;
  mobile?: string;
  callType?: string;
  journeyStage?: string;
  qualityScore?: number | string;
  qualityBand?: string;
  pitchStrength?: string;
  leakage?: string;
  supportStatus?: string;
  riskBucket?: string;
  riskLevel?: string;
  progressed?: boolean;
  disbursal?: boolean;
  actionPriority?: string;
  actionOwner?: string;
  actionSla?: string;
  insight?: string;
}

export interface RiskQueueData {
  records: RiskQueueRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TniHeatmapData {
  heatmap?: Array<{ parameter: string; values: Array<{ date: string; score: number; volume: number }> }>;
  tni?: Array<{ label: string; tni: number; fatal: number; defect: number }>;
  processTNI?: Array<{ process: string; tni: number }>;
}

export interface DrilldownData {
  title: string;
  records: RiskQueueRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ComplianceSummaryData {
  buckets?: CountItem[];
  highPriority?: RiskQueueRecord[];
  medium?: RiskQueueRecord[];
  evidenceQueue?: RiskQueueRecord[];
}

export interface JourneySummaryData {
  callTypes?: CountItem[];
  stages?: CountItem[];
  supportStatuses?: CountItem[];
  pendingCount?: number;
  pendingCalls?: RiskQueueRecord[];
}

export interface QualityDistributionData {
  bands?: CountItem[];
  byCallType?: Array<{ label: string; average: number; scoredCalls: number }>;
  parameters?: Array<{ label: string; average: number; assessedCalls: number }>;
}

export interface TopBottomAgentsData {
  analysts: Array<{
    agentName: string;
    avgScore?: number | null;
    totalCalls?: number;
    scoredCalls?: number;
    pitchAttempts?: number;
    strongPitch?: number;
    highRiskCount?: number;
    opportunities?: number;
    disbursals?: number;
    lastCallDate?: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface SensitiveWordTerm {
  term: string;
  count: number;
}

export interface SensitiveAgentCount {
  agentName: string;
  incidentCount: number;
}

export interface SensitiveContextSnippet {
  callId: string;
  maskedContext: string;
  agentName: string;
  callDate: string;
  maskedMobile: string;
}

export interface SensitiveWordsData {
  totalRows: number;
  totalIncidents: number;
  byTerm: SensitiveWordTerm[];
  byAgent: SensitiveAgentCount[];
  byCustomerTerm: SensitiveWordTerm[];
  recentContexts: SensitiveContextSnippet[];
}

export interface RiskByProcessRow {
  process: string;
  totalCalls: number;
  criticalCalls: number;
  highRiskCalls: number;
  mediumRiskCalls: number;
  safeCalls: number;
  averageQuality: number | null;
  topRiskBucket?: string;
  topQualityBand?: string;
}

export interface RiskByProcessData {
  dimension: 'category' | 'process_name';
  rows: RiskByProcessRow[];
}

export interface AnalystDailyTrendPoint {
  date: string;
  avgScore: number | null;
  totalCalls: number;
  scoredCalls: number;
  pitchAttempts: number;
  highRiskCount: number;
}

export interface AnalystDailyTrendData {
  trend: AnalystDailyTrendPoint[];
}

export interface ParameterTrendPoint {
  date: string;
  total: number;
  passed: number;
  passRate: number | null;
}

export interface ParameterTrendSeries {
  parameter: string;
  passedValues: string[];
  series: ParameterTrendPoint[];
}

export interface ParameterTrendData {
  source: 'finnable';
  parameters: string[];
  trend: ParameterTrendSeries[];
  daysCovered: number;
}

// ─── Drilldown payload shape ────────────────────────────────────────────────

export interface DrilldownPayload {
  dimension: string;
  value: string;
  client_id?: string;
  process_name?: string;
  analyst_id?: string;
  team_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
