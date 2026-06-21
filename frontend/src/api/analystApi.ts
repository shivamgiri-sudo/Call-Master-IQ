import { http } from './httpClient';
import type { AnalyticsFilters } from './analyticsApi';
import type { AnalystDailyTrendPoint, RiskQueueRecord, TopBottomAgentsData } from './types';

export interface AnalystSummaryData {
  analystId: string;
  matchedAnalyst: string;
  summary: TopBottomAgentsData['analysts'][number] | null;
  totalCalls: number;
  matchingLogic: string;
}

export interface AnalystTrendData {
  analystId: string;
  matchedAnalyst: string;
  trend: AnalystDailyTrendPoint[];
}

export interface AnalystEvidenceData {
  analystId: string;
  matchedAnalyst: string;
  records: RiskQueueRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AnalystCoachingData {
  analystId: string;
  matchedAnalyst: string;
  weaknesses: Array<{ parameter: string; total: number; passRate: number | null }>;
  recommendations: string[];
  summary: TopBottomAgentsData['analysts'][number] | null;
}

export const getAnalystSummary = (analystId: string, filters: AnalyticsFilters) =>
  http.get<AnalystSummaryData>(`/api/analytics/analysts/${encodeURIComponent(analystId)}/summary`, filters);

export const getAnalystTrend = (analystId: string, filters: AnalyticsFilters) =>
  http.get<AnalystTrendData>(`/api/analytics/analysts/${encodeURIComponent(analystId)}/trend`, filters);

export const getAnalystEvidence = (analystId: string, filters: AnalyticsFilters & { offset?: number }) =>
  http.get<AnalystEvidenceData>(`/api/analytics/analysts/${encodeURIComponent(analystId)}/evidence`, filters);

export const getAnalystCoaching = (analystId: string, filters: AnalyticsFilters) =>
  http.get<AnalystCoachingData>(`/api/analytics/analysts/${encodeURIComponent(analystId)}/coaching`, filters);
