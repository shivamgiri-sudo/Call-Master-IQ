/**
 * Finnable Intelligence Module — Type Definitions
 * Ported from finnable-dashboard analyticsEngine.js V5.3.7
 * All types are read-only output shapes; no mutation types exist.
 */

// ─── Raw row from db_external.CallDetails ────────────────────────────────────

export interface RawCallRow {
  id: string | number;
  client_id: string;
  AgentName: string;
  CallDate: string;
  MobileNo: string;
  ConsumptionType: string;
  AgeofConsumption: string;
  UpsellingEfforts: string;
  Feedback_Category: string;
  Feedback: string;
  FeedbackContext: string;
  AreaForImprovement: string;
  Category: string;
  SubCategory: string;
  PrepaidPitch: string;
  PrepaidPitchContext?: string;
  OfferedPitchContext?: string;
  CustomerObjectionCategory: string;
  CustomerObjectionSubCategory: string;
  ObjectionHandling: string;
  ObjectionHandlingContext?: string;
  SensitiveWordUsed: string;
  SensitiveWordContext?: string;
  Snapmint_Pitch: string;
  Pricing_and_Discount_Structure: string;
  Sale_Pitch_Discount_Structure?: string;
  CallDisposition: string;
  SaleDone: string;
  Further_Assistance: string;
  Order_Consent: string;
  Call_Closing: string;
  Product_Appreciation: string;
  TranscribeText?: string;
}

// ─── Enriched row after analytics engine derivation ──────────────────────────

export type QualityBand =
  | 'Excellent'
  | 'Good'
  | 'Improvement Required'
  | 'High Risk'
  | 'Critical Coaching'
  | 'Non-Assessable'
  | 'Limited Evidence';

export type RiskBucket =
  | 'High Priority Risk Trigger'
  | 'Medium Transparency / Sensitive Flag'
  | 'Safe / Guided Self-Entry'
  | 'No Risk Flag';

export type SalesLeakage =
  | 'Not Applicable'
  | 'No Pitch Attempted'
  | 'Weak Pitch'
  | 'Pricing Disclosure Gap'
  | 'Objection Not Resolved'
  | 'Journey Blocker'
  | 'Consent Gap'
  | 'Closing Gap'
  | 'No Major Leakage';

export type ActionPriority =
  | 'P1 Validate'
  | 'P2 Coach / Validate'
  | 'P3 Sales Coaching'
  | 'P3 Journey Follow-Up'
  | 'Monitor';

export interface ActionItem {
  priority: ActionPriority;
  owner: string;
  sla: string;
  reason: string;
}

export interface EnrichedCallRow extends RawCallRow {
  callType: string;
  journeyStage: string;
  pitchStrength: string;
  score: number | null;
  nonAssessable: boolean;
  qualityBand: QualityBand;
  opportunity: boolean;
  progressed: boolean;
  disbursal: boolean;
  riskBucket: RiskBucket;
  supportStatus: string;
  salesLeakage: SalesLeakage;
  evidenceHighlights: EvidenceHighlight[];
  action: ActionItem;
}

// ─── Evidence package (detail view) ──────────────────────────────────────────

export interface EvidenceHighlight {
  parameter: string;
  severity: 'high' | 'medium' | 'safe' | 'info';
  label: string;
  rationale: string;
  auditImpact: string;
  phrase: string;
  snippet: string;
  start: number;
  end: number;
  score: string;
  marksLost: number | null;
}

export interface ParameterEvidenceItem {
  parameter: string;
  score: string;
  marksLost: number | null;
  status: string;
  severity: 'high' | 'medium' | 'safe' | 'info';
  title: string;
  rationale: string;
  evidence: string;
  highlightStart: number | null;
  highlightEnd: number | null;
}

export interface EvidencePackage {
  parameterEvidence: ParameterEvidenceItem[];
  highlights: EvidenceHighlight[];
  highlightRanges: HighlightRange[];
}

export interface HighlightRange {
  start: number;
  end: number;
  severity: 'high' | 'medium' | 'safe' | 'info';
  parameter: string;
  label: string;
  rationale: string;
}

// ─── Summary / KPI shapes ────────────────────────────────────────────────────

export interface FinnableSummary {
  totalCalls: number;
  nonAssessable: number;
  meaningfulCalls: number;
  qualityScoredCalls: number;
  avgQuality: number;
  salesMixedAvgQuality: number;
  supportAvgQuality: number;
  opportunities: number;
  pitched: number;
  pitchAttemptRate: number;
  strongPitch: number;
  objections: number;
  objectionHandled: number;
  highRiskTriggers: number;
  mediumFlags: number;
  safeGuidance: number;
  disbursalSignal: number;
}

export interface SalesFunnel {
  funnel: CountItem[];
  pitchStrength: CountItem[];
  leakage: CountItem[];
  pricing: CountItem[];
  objections: CountItem[];
  themes: ThemeItem[];
}

export interface CountItem {
  label: string;
  count: number;
}

export interface ThemeItem {
  label: string;
  count: number;
  avgQuality: number;
  progressionRate: number;
  riskCount: number;
}

export interface JourneySummary {
  callTypes: CountItem[];
  stages: CountItem[];
  supportStatuses: CountItem[];
  pendingCount: number;
  pendingCalls: LightRecord[];
}

export interface QualitySummary {
  bands: CountItem[];
  byCallType: { label: string; average: number; scoredCalls: number }[];
  parameters: { label: string; average: number; assessedCalls: number }[];
}

export interface ComplianceSummary {
  buckets: CountItem[];
  highPriority: LightRecord[];
  medium: LightRecord[];
  evidenceQueue: LightRecord[];
}

export interface LightRecord {
  id: string;
  date: string;
  analyst: string;
  mobile: string;
  callType: string;
  journeyStage: string;
  qualityScore: number | string;
  qualityBand: QualityBand;
  pitchStrength: string;
  leakage: SalesLeakage;
  supportStatus: string;
  riskBucket: RiskBucket;
  riskLevel: string;
  progressed: boolean;
  disbursal: boolean;
  actionPriority: ActionPriority;
  actionOwner: string;
  actionSla: string;
  insight: string;
}

export interface AnalystProfile {
  agentId: string;
  analystName: string;
  tlName: string;
  teamName: string;
  calls: number;
  scoredCalls: number;
  avgQuality: number;
  salesMixedAvgQuality: number;
  opportunities: number;
  pitchAttemptRate: number;
  strongPitch: number;
  highRiskTriggers: number;
  mediumFlags: number;
  primaryLeakage: string;
  priority: ActionPriority | 'Monitor';
}

export interface ActionQueueItem {
  callId: string;
  callDate: string;
  analyst: string;
  tlName: string;
  priority: ActionPriority;
  owner: string;
  sla: string;
  reason: string;
  qualityScore: number | string;
  callType: string;
  journeyStage: string;
  insight: string;
}

export interface Callout {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  text: string;
}

// ─── TNI types ───────────────────────────────────────────────────────────────

export type TNIPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface TNIItem {
  agentName: string;
  category: string;
  subCategory: string;
  defectCount: number;
  fatalCount: number;
  priority: TNIPriority;
  coachingNeed: string;
  lastDate: string;
}

export interface ProcessTNIItem {
  category: string;
  subCategory: string;
  defectCount: number;
  fatalCount: number;
  affectedAnalysts: number;
  priority: TNIPriority;
  lastDate: string;
}

export interface ParameterHeatmapItem {
  name: string;
  avgPct: number | null;
  scoredCalls: number;
  lowPctCalls: number;
  zeroCalls: number;
  failRate: number | null;
}

// ─── Trend types ─────────────────────────────────────────────────────────────

export interface DayTrendItem {
  date: string;
  avgScore: number | null;
  totalCalls: number;
  scoredCalls: number;
  pitchAttempts: number;
  highRiskCount: number;
}

export interface ScoreBandItem {
  label: string;
  count: number;
}

// ─── Filter types ────────────────────────────────────────────────────────────

export interface FinnableFilters {
  clientId: string;
  recordId?: string;
  fromDate?: string;
  toDate?: string;
  agent?: string;
  callType?: string;
  journeyStage?: string;
  pitchStrength?: string;
  riskBucket?: string;
  actionPriority?: string;
  search?: string;
}

export interface FilterOptions {
  agents: string[];
  callTypes: string[];
  journeyStages: string[];
  pitchStrengths: string[];
  riskBuckets: string[];
  actionPriorities: string[];
}

// ─── Agent mapping ───────────────────────────────────────────────────────────

export interface AgentMapping {
  analystName: string;
  tlName: string;
  teamName: string;
  branch: string;
}

export type AgentMappingMap = Record<string, AgentMapping>;

// ─── Dashboard composite response ───────────────────────────────────────────

export interface FinnableDashboard {
  source: string;
  clientId: string;
  refreshedAt: string;
  filters: FinnableFilters;
  filterOptions: FilterOptions;
  summary: FinnableSummary;
  sales: SalesFunnel;
  journey: JourneySummary;
  quality: QualitySummary;
  compliance: ComplianceSummary;
  analysts: AnalystProfile[];
  actions: ActionQueueItem[];
  callouts: Callout[];
  performance: { sqlQueryMs: number; cacheHit: boolean; totalApiMs: number };
}

// ─── Repository query options (read-only safety) ─────────────────────────────

export interface RepositoryQueryOptions {
  clientId: string;
  fromDate?: string;
  toDate?: string;
  agentName?: string;
  limit?: number;
}

export const MAX_QUERY_ROWS = 50000;
export const MAX_RISK_ROWS = 500;
export const DEFAULT_CLIENT_ID = '497';
export const FINNABLE_CACHE_TTL_MS = 15000;
