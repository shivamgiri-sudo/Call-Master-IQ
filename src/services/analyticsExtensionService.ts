/**
 * Analytics Extension Service — Phase 2 approved endpoints
 * Uses resolveAnalyticsAdapter() for Finnable vs generic routing.
 * All Finnable queries go through read-only db_external repository.
 * All generic queries use existing v_call_master_* views.
 */
import pool from '../config/db';
import { ScopeFilter, buildScopeWhereClause } from '../middleware/rbac';
import {
  resolveAnalyticsAdapter,
  enrichRows,
  repository as finnableRepo,
  analyticsEngine,
  tniEngine,
  trendEngine,
  riskEngine,
  sensitiveWordsEngine,
  DEFAULT_CLIENT_ID,
  FINNABLE_CACHE_TTL_MS,
  FinnableFilters,
  AgentMappingMap,
} from './finnable';

const ANALYTICS_MAX_DATE_RANGE_DAYS = Number(process.env.ANALYTICS_MAX_DATE_RANGE_DAYS || 90);
const DEFAULT_DATE_RANGE_DAYS = 30;

export interface AnalyticsExtensionFilter {
  scope: ScopeFilter;
  client_id?: string;
  process_name?: string;
  business_lob?: string;
  branch_short_name?: string;
  from?: string;
  to?: string;
  source_type?: string;
  page?: number;
  limit?: number;
}

export async function getFilterOptions(filter: { scope: ScopeFilter }) {
  const started = Date.now();
  const scope = filter.scope || {};

  const mappingConditions = ['active_status = 1'];
  const mappingParams: any[] = [];
  if (scope.client_id) { mappingConditions.push('dialdesk_client_id = ?'); mappingParams.push(scope.client_id); }
  if (scope.process_name) { mappingConditions.push('process_name = ?'); mappingParams.push(scope.process_name); }
  if (scope.business_lob) { mappingConditions.push('business_lob = ?'); mappingParams.push(scope.business_lob); }
  if (scope.source_type) { mappingConditions.push('source_type = ?'); mappingParams.push(scope.source_type); }
  if (scope.branch_short_name) { mappingConditions.push('branch = ?'); mappingParams.push(scope.branch_short_name); }

  const mappingWhere = `WHERE ${mappingConditions.join(' AND ')}`;

  const branchConditions = ['active_status = 1', 'branch_short_name IS NOT NULL', "branch_short_name <> ''"];
  const branchParams: any[] = [];
  if (scope.branch_short_name) { branchConditions.push('branch_short_name = ?'); branchParams.push(scope.branch_short_name); }

  const [clientRows, processRows, lobRows, branchRows, sourceRows] = await Promise.all([
    pool.execute<any[]>(
      `SELECT dialdesk_client_id AS value, COUNT(*) AS count
       FROM process_mapping_master ${mappingWhere}
       AND dialdesk_client_id IS NOT NULL AND dialdesk_client_id <> ''
       GROUP BY dialdesk_client_id
       ORDER BY count DESC
       LIMIT 50`,
      mappingParams
    ),
    pool.execute<any[]>(
      `SELECT process_name AS value, COUNT(*) AS count
       FROM process_mapping_master ${mappingWhere}
       AND process_name IS NOT NULL AND process_name <> ''
       GROUP BY process_name
       ORDER BY value
       LIMIT 100`,
      mappingParams
    ),
    pool.execute<any[]>(
      `SELECT business_lob AS value, COUNT(*) AS count
       FROM process_mapping_master ${mappingWhere}
       AND business_lob IS NOT NULL AND business_lob <> ''
       GROUP BY business_lob
       ORDER BY value
       LIMIT 100`,
      mappingParams
    ),
    pool.execute<any[]>(
      `SELECT branch_short_name AS value, COUNT(*) AS count
       FROM employee_mapping_master
       WHERE ${branchConditions.join(' AND ')}
       GROUP BY branch_short_name
       ORDER BY count DESC
       LIMIT 100`,
      branchParams
    ),
    pool.execute<any[]>(
      `SELECT source_type AS value, COUNT(*) AS count
       FROM process_mapping_master ${mappingWhere}
       AND source_type IS NOT NULL AND source_type <> ''
       GROUP BY source_type
       ORDER BY value
       LIMIT 20`,
      mappingParams
    ),
  ]);

  const normalize = (rows: any[]) => rows
    .filter(r => r.value !== null && r.value !== undefined && String(r.value).trim() !== '')
    .map(r => ({ value: String(r.value), label: String(r.value), count: Number(r.count || 0) }));

  const clients = normalize(clientRows[0]);
  if (!clients.some(c => c.value === DEFAULT_CLIENT_ID)) {
    clients.unshift({ value: DEFAULT_CLIENT_ID, label: `${DEFAULT_CLIENT_ID} · Finnable`, count: 0 });
  }

  return buildResponseEnvelope(
    {
      clients,
      processes: normalize(processRows[0]),
      businessLobs: normalize(lobRows[0]),
      branches: normalize(branchRows[0]),
      sources: normalize(sourceRows[0]),
      defaults: {
        client_id: DEFAULT_CLIENT_ID,
      },
    },
    { source: 'generic', queryMs: Date.now() - started, totalMs: Date.now() - started }
  );
}

interface DateRange {
  from: string;
  to: string;
}

function validateDateRange(from?: string, to?: string): DateRange {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DATE_RANGE_DAYS);
  defaultFrom.setHours(0, 0, 0, 0);

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : now;

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error('INVALID_DATE_FORMAT');
  }

  const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > ANALYTICS_MAX_DATE_RANGE_DAYS) {
    throw new Error('DATE_RANGE_EXCEEDED');
  }
  if (daysDiff < 0) {
    throw new Error('INVALID_DATE_RANGE');
  }

  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  };
}

function buildResponseEnvelope(data: any, meta: any) {
  return {
    success: true,
    data,
    meta: {
      source: meta.source || 'generic',
      cacheHit: meta.cacheHit ?? false,
      queryMs: meta.queryMs ?? 0,
      totalMs: meta.totalMs ?? 0,
      from: meta.from,
      to: meta.to,
      ...meta,
    },
  };
}

// Lightweight cache for Finnable summary rows (client-id keyed)
const finnableSummaryCache = new Map<string, { data: any; expiresAt: number }>();

function getCachedFinnableSummary(clientId: string) {
  const item = finnableSummaryCache.get(clientId);
  if (item && Date.now() < item.expiresAt) return item.data;
  return null;
}

function setCachedFinnableSummary(clientId: string, data: any) {
  finnableSummaryCache.set(clientId, { data, expiresAt: Date.now() + FINNABLE_CACHE_TTL_MS });
}

async function fetchFinnableData(filter: AnalyticsExtensionFilter, range: DateRange) {
  const started = Date.now();
  const clientId = String(filter.client_id || DEFAULT_CLIENT_ID);
  const cacheKey = `${clientId}:${range.from}:${range.to}`;
  const cached = getCachedFinnableSummary(cacheKey);
  if (cached) {
    return { ...cached, cacheHit: true, totalMs: Date.now() - started };
  }

  const queryStarted = Date.now();
  const rawRows = await finnableRepo.fetchSummaryRows({
    clientId,
    fromDate: range.from,
    toDate: range.to,
    agentName: undefined,
  });
  const queryMs = Date.now() - queryStarted;

  const agentNameMap = await finnableRepo.fetchAgentNameMap();
  const resolvedRows = rawRows.map(r => ({
    ...r,
    AgentName: agentNameMap[r.AgentName] || r.AgentName,
  }));

  const enrichedRows = enrichRows(resolvedRows);

  const result = {
    rawRows: resolvedRows,
    enrichedRows,
    queryMs,
  };

  setCachedFinnableSummary(cacheKey, result);
  return { ...result, cacheHit: false, totalMs: Date.now() - started };
}

// ─── Endpoint implementations ────────────────────────────────────────────────

export async function getSplitKPIs(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const summary = analyticsEngine.buildSummary(finnableData.enrichedRows);
    const sales = analyticsEngine.buildSales(finnableData.enrichedRows);
    const quality = analyticsEngine.buildQuality(finnableData.enrichedRows);
    const compliance = analyticsEngine.buildCompliance(finnableData.enrichedRows);

    return buildResponseEnvelope(
      {
        totalCalls: summary.totalCalls,
        qualityScoredCalls: summary.qualityScoredCalls,
        avgQuality: summary.avgQuality,
        salesMixedAvgQuality: summary.salesMixedAvgQuality,
        supportAvgQuality: summary.supportAvgQuality,
        opportunities: summary.opportunities,
        pitched: summary.pitched,
        strongPitch: summary.strongPitch,
        highRiskTriggers: summary.highRiskTriggers,
        mediumFlags: summary.mediumFlags,
        disbursalSignal: summary.disbursalSignal,
        qualityBands: quality.bands,
        riskBuckets: compliance.buckets,
        salesFunnel: sales.funnel,
      },
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  // Generic adapter (existing v_call_master_unified_kpi)
  const { clause, params } = buildScopeWhereClause(filter.scope);
  const conditions = [clause !== '1=1' ? clause : ''];
  const queryParams = clause !== '1=1' ? [...params] : [];

  if (filter.client_id) { conditions.push('client_id = ?'); queryParams.push(filter.client_id); }
  if (filter.process_name) { conditions.push('process_name = ?'); queryParams.push(filter.process_name); }
  if (filter.business_lob) { conditions.push('business_lob = ?'); queryParams.push(filter.business_lob); }
  if (filter.branch_short_name) { conditions.push('branch_short_name = ?'); queryParams.push(filter.branch_short_name); }
  if (filter.source_type) { conditions.push('source_type = ?'); queryParams.push(filter.source_type); }
  conditions.push('call_date >= ?'); queryParams.push(range.from);
  conditions.push('call_date <= ?'); queryParams.push(range.to);

  const where = `WHERE ${conditions.filter(c => c).join(' AND ')}`;

  const queryStarted = Date.now();
  const [rows] = await pool.execute<any[]>(
    `SELECT
       COUNT(*) AS totalCalls,
       COUNT(CASE WHEN quality_score IS NOT NULL THEN 1 END) AS qualityScoredCalls,
       ROUND(AVG(quality_score), 2) AS avgQuality,
       COUNT(CASE WHEN is_critical_call = 1 THEN 1 END) AS criticalCalls
     FROM v_call_master_unified_kpi ${where}`,
    queryParams
  );
  const queryMs = Date.now() - queryStarted;

  return buildResponseEnvelope(rows[0], { source: 'generic', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getSalesIntelligence(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const sales = analyticsEngine.buildSales(finnableData.enrichedRows);
    return buildResponseEnvelope(sales, { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false, reason: 'Sales intelligence requires Finnable adapter' }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getTNIHeatmap(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const clientId = String(filter.client_id || DEFAULT_CLIENT_ID);
    const queryStarted = Date.now();
    const tniRows = await finnableRepo.fetchTNIRows({ clientId, fromDate: range.from, toDate: range.to });
    const queryMs = Date.now() - queryStarted;

    const heatmap = tniEngine.buildParameterHeatmap(tniRows);
    const tni = tniEngine.buildTNI(tniRows);
    const processTNI = tniEngine.buildProcessTNI(tni);

    return buildResponseEnvelope({ heatmap, tni, processTNI }, { source: 'finnable', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false, reason: 'TNI heatmap requires Finnable adapter' }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getRiskQueue(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const clientId = String(filter.client_id || DEFAULT_CLIENT_ID);
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(filter.limit) || 50));

    const queryStarted = Date.now();
    const riskRows = await finnableRepo.fetchRiskRows({ clientId, fromDate: range.from, toDate: range.to, limit: 500 });
    const queryMs = Date.now() - queryStarted;

    const agentNameMap = await finnableRepo.fetchAgentNameMap();
    const resolvedRows = riskRows.map((r: any) => ({ ...r, AgentName: agentNameMap[r.AgentName] || r.AgentName }));
    const enrichedRows = enrichRows(resolvedRows);

    const start = (page - 1) * limit;
    const paginatedRows = enrichedRows.slice(start, start + limit);

    return buildResponseEnvelope(
      {
        records: paginatedRows.map(analyticsEngine.lightRecord),
        total: enrichedRows.length,
        page,
        limit,
        totalPages: Math.ceil(enrichedRows.length / limit),
      },
      { source: 'finnable', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  return buildResponseEnvelope({ supported: false, reason: 'Risk queue requires Finnable adapter' }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

// ─── /sales-funnel — implemented for Finnable, generic supported:false ────────
//
// Returns a stage-by-stage funnel (Opportunities → Pitched → Strong Pitch →
// Progressed → Disbursal) with conversion rates. The generic view does not
// expose the per-stage parameters needed for a real funnel, so we return
// supported:false for generic.
export async function getSalesFunnel(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const funnel = analyticsEngine.buildSalesFunnel(finnableData.enrichedRows);
    return buildResponseEnvelope(
      funnel,
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  return buildResponseEnvelope(
    { supported: false, reason: 'FUNNEL_COLUMNS_NOT_AVAILABLE' },
    { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to }
  );
}

export async function getLeakageReport(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const sales = analyticsEngine.buildSales(finnableData.enrichedRows);
    return buildResponseEnvelope({ leakage: sales.leakage, pricing: sales.pricing, objections: sales.objections }, { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getComplianceSummary(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const compliance = analyticsEngine.buildCompliance(finnableData.enrichedRows);
    return buildResponseEnvelope(compliance, { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getJourneySummary(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const journey = analyticsEngine.buildJourney(finnableData.enrichedRows);
    return buildResponseEnvelope(journey, { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getQualityDistribution(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const quality = analyticsEngine.buildQuality(finnableData.enrichedRows);
    return buildResponseEnvelope(quality, { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getTopBottomAgents(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const analysts = analyticsEngine.buildAnalysts(finnableData.enrichedRows, {});
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(filter.limit) || 20));
    const start = (page - 1) * limit;

    return buildResponseEnvelope(
      { analysts: analysts.slice(start, start + limit), total: analysts.length, page, limit },
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getDrilldown(filter: AnalyticsExtensionFilter, dimension: string, value: string) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const filtered = finnableData.enrichedRows.filter((row: any) => analyticsEngine.insightMatches(row, dimension, value));
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(filter.limit) || 20));
    const start = (page - 1) * limit;

    return buildResponseEnvelope(
      {
        title: analyticsEngine.drilldownTitle(dimension, value),
        records: filtered.slice(start, start + limit).map(analyticsEngine.lightRecord),
        total: filtered.length,
        page,
        limit,
      },
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

// ─── /sensitive-words — implemented for Finnable, honest generic fallback ────
//
// Source columns (db_external.CallDetails):
//   SensitiveWordUsed, SensitiveWordContext,
//   TopNegativeWordsByAgent, TopNegativeWordsByCustomer
// The unified KPI view does NOT expose these columns, so the generic adapter
// returns supported:false with reason SENSITIVE_WORD_COLUMNS_NOT_AVAILABLE.
export async function getSensitiveWords(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const clientId = String(filter.client_id || DEFAULT_CLIENT_ID);
    const queryStarted = Date.now();
    const rows = await finnableRepo.fetchSensitiveWordRows({
      clientId,
      fromDate: range.from,
      toDate: range.to,
    });
    const queryMs = Date.now() - queryStarted;

    // Resolve agent names via Shivamgiri pool (read-only lookup)
    const agentNameMap = await finnableRepo.fetchAgentNameMap();
    const resolvedRows = rows.map((r: any) => ({
      ...r,
      AgentName: agentNameMap[r.AgentName] || r.AgentName,
    }));

    const summary = sensitiveWordsEngine.buildSensitiveWordsSummary(resolvedRows);

    return buildResponseEnvelope(
      summary,
      { source: 'finnable', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  return buildResponseEnvelope(
    { supported: false, reason: 'SENSITIVE_WORD_COLUMNS_NOT_AVAILABLE' },
    { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to }
  );
}

export async function getRiskByProcess(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const rows = analyticsEngine.buildRiskByProcess(finnableData.enrichedRows);
    return buildResponseEnvelope(
      { dimension: 'category', rows },
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  // Generic path — real GROUP BY against v_call_master_unified_kpi.
  // Verified columns (src/config/phase2_tables.sql:121-140):
  //   process_name, is_critical_call, alert_severity, quality_band, call_date
  const { clause, params } = buildScopeWhereClause(filter.scope);
  const conditions = [clause !== '1=1' ? clause : ''];
  const queryParams = clause !== '1=1' ? [...params] : [];

  if (filter.client_id) { conditions.push('client_id = ?'); queryParams.push(filter.client_id); }
  if (filter.process_name) { conditions.push('process_name = ?'); queryParams.push(filter.process_name); }
  if (filter.business_lob) { conditions.push('business_lob = ?'); queryParams.push(filter.business_lob); }
  if (filter.branch_short_name) { conditions.push('branch_short_name = ?'); queryParams.push(filter.branch_short_name); }
  if (filter.source_type) { conditions.push('source_type = ?'); queryParams.push(filter.source_type); }
  conditions.push('call_date >= ?'); queryParams.push(range.from);
  conditions.push('call_date <= ?'); queryParams.push(range.to);

  const where = `WHERE ${conditions.filter(c => c).join(' AND ')}`;

  const queryStarted = Date.now();
  const [rows] = await pool.execute<any[]>(
    `SELECT
       process_name AS process,
       COUNT(*) AS totalCalls,
       SUM(CASE WHEN is_critical_call = 1 THEN 1 ELSE 0 END) AS criticalCalls,
       SUM(CASE WHEN alert_severity = 'High' THEN 1 ELSE 0 END) AS highRiskCalls,
       SUM(CASE WHEN alert_severity = 'Medium' THEN 1 ELSE 0 END) AS mediumRiskCalls,
       SUM(CASE WHEN alert_severity = 'Normal' OR alert_severity IS NULL THEN 1 ELSE 0 END) AS safeCalls,
       ROUND(AVG(quality_score), 2) AS averageQuality,
       SUBSTRING_INDEX(GROUP_CONCAT(quality_band ORDER BY quality_band), ',', 1) AS topQualityBand
     FROM v_call_master_unified_kpi ${where}
     GROUP BY process_name
     ORDER BY criticalCalls DESC, totalCalls DESC
     LIMIT 200`,
    queryParams
  );
  const queryMs = Date.now() - queryStarted;

  return buildResponseEnvelope(
    { dimension: 'process_name', rows },
    { source: 'generic', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
  );
}

export async function getAnalystDailyTrend(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const clientId = String(filter.client_id || DEFAULT_CLIENT_ID);
    const queryStarted = Date.now();
    const trendRows = await finnableRepo.fetchTrendRows({ clientId, fromDate: range.from, toDate: range.to });
    const queryMs = Date.now() - queryStarted;

    const dayTrend = trendEngine.buildDayTrend(trendRows);
    return buildResponseEnvelope({ trend: dayTrend }, { source: 'finnable', queryMs, totalMs: Date.now() - started, from: range.from, to: range.to });
  }

  return buildResponseEnvelope({ supported: false }, { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to });
}

export async function getParameterTrend(filter: AnalyticsExtensionFilter) {
  const started = Date.now();
  const range = validateDateRange(filter.from, filter.to);
  const adapter = resolveAnalyticsAdapter({ client_id: filter.client_id, process_name: filter.process_name });

  if (adapter === 'finnable') {
    const finnableData = await fetchFinnableData(filter, range);
    const trend = analyticsEngine.buildParameterTrend(finnableData.enrichedRows);
    return buildResponseEnvelope(
      trend,
      { source: 'finnable', cacheHit: finnableData.cacheHit, queryMs: finnableData.queryMs, totalMs: Date.now() - started, from: range.from, to: range.to }
    );
  }

  // Generic: v_call_master_unified_kpi has no parameter-level columns
  // (verified via src/config/phase2_tables.sql:121-140 — only quality_score,
  //  total_score, max_score, quality_band, is_critical_call, alert_severity).
  // Honest response: supported:false with explicit reason.
  return buildResponseEnvelope(
    { supported: false, reason: 'GENERIC_PARAMETER_COLUMNS_NOT_AVAILABLE' },
    { source: 'generic', totalMs: Date.now() - started, from: range.from, to: range.to }
  );
}
