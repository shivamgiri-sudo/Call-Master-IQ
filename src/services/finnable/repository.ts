/**
 * Finnable Intelligence Module — Read-Only Repository
 *
 * SAFETY: This module ONLY issues SELECT queries against db_external.
 * No INSERT, UPDATE, DELETE, ALTER, DROP, or TRUNCATE statements exist here.
 * All queries enforce row limits via LIMIT ${n} (never unbounded).
 * Every query passes assertSelectOnly() before execution.
 *
 * Ported from finnable-dashboard/src/repositories/auditRepository.js
 * and finnable-dashboard/src/repositories/trendRepository.js
 */
import dbExternalPool from '../../config/dbExternal';
import pool from '../../config/db';
import { RawCallRow, RepositoryQueryOptions, MAX_QUERY_ROWS, MAX_RISK_ROWS } from './types';

// ─── Read-only query guard ───────────────────────────────────────────────────

function assertSelectOnly(sql: string): void {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith('select')) {
    throw new Error('READONLY_DB_VIOLATION');
  }
  const forbidden = /\b(insert|update|delete|alter|drop|truncate|replace|create)\b/i;
  if (forbidden.test(sql)) {
    throw new Error('READONLY_DB_VIOLATION');
  }
}

// ─── Column definitions ──────────────────────────────────────────────────────

const SUMMARY_COLUMNS = [
  'id', 'client_id', 'AgentName', 'CallDate', 'MobileNo', 'ConsumptionType',
  'AgeofConsumption', 'UpsellingEfforts', 'Feedback_Category', 'Feedback',
  'FeedbackContext', 'AreaForImprovement', 'Category', 'SubCategory',
  'PrepaidPitch', 'CustomerObjectionCategory', 'CustomerObjectionSubCategory',
  'ObjectionHandling', 'SensitiveWordUsed', 'Snapmint_Pitch',
  'Pricing_and_Discount_Structure', 'CallDisposition', 'SaleDone',
  'Further_Assistance', 'Order_Consent', 'Call_Closing', 'Product_Appreciation',
] as const;

const DETAIL_COLUMNS = [
  ...SUMMARY_COLUMNS,
  'PrepaidPitchContext', 'OfferedPitchContext',
  'ObjectionHandlingContext', 'SensitiveWordContext',
  'Sale_Pitch_Discount_Structure', 'TranscribeText',
] as const;

const TREND_COLUMNS = [
  'AgentName', 'CallDate', 'Feedback_Category', 'ConsumptionType',
  'PrepaidPitch', 'Snapmint_Pitch', 'UpsellingEfforts', 'SaleDone', 'CallDisposition',
  'FeedbackContext', 'Category', 'SubCategory', 'AreaForImprovement',
] as const;

const TNI_COLUMNS = [
  'AgentName', 'CallDate', 'Category', 'SubCategory', 'AreaForImprovement',
  'ConsumptionType', 'Snapmint_Pitch', 'FeedbackContext', 'Feedback_Category',
] as const;

const RISK_COLUMNS = [
  'id', 'AgentName', 'CallDate', 'Snapmint_Pitch', 'SensitiveWordUsed',
  'Feedback_Category', 'ConsumptionType', 'AreaForImprovement', 'Feedback', 'MobileNo',
] as const;

const SENSITIVE_WORD_COLUMNS = [
  'id', 'AgentName', 'CallDate', 'SensitiveWordUsed', 'SensitiveWordContext',
  'TopNegativeWordsByAgent', 'TopNegativeWordsByCustomer',
  'Feedback_Category', 'AreaForImprovement', 'MobileNo',
] as const;

const TABLE = 'CallDetails';
const MAX_ANALYST_GROUPS = 1000;
const MAX_SENSITIVE_ROWS = 5000;

function cols(columns: readonly string[]): string {
  return columns.map(c => `\`${c}\``).join(', ');
}

function safeLimit(requested: number | undefined, max: number): number {
  const n = Math.floor(Number(requested) || max);
  return Math.min(Math.max(1, n), max);
}

// ─── db_external queries (read-only, guarded) ────────────────────────────────

export async function fetchSummaryRows(opts: RepositoryQueryOptions): Promise<RawCallRow[]> {
  const limit = safeLimit(opts.limit, MAX_QUERY_ROWS);
  const params: (string | number)[] = [String(opts.clientId)];
  let sql = `SELECT ${cols(SUMMARY_COLUMNS)} FROM \`${TABLE}\` WHERE \`client_id\` = ?`;

  if (opts.fromDate) { sql += ' AND `CallDate` >= ?'; params.push(opts.fromDate); }
  if (opts.toDate) { sql += ' AND `CallDate` <= ?'; params.push(opts.toDate); }
  if (opts.agentName) { sql += ' AND `AgentName` = ?'; params.push(opts.agentName); }

  sql += ` ORDER BY \`CallDate\` DESC LIMIT ${limit}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows as RawCallRow[];
}

export async function fetchCallDetail(clientId: string, callId: string): Promise<RawCallRow | null> {
  const sql = `SELECT ${cols(DETAIL_COLUMNS)} FROM \`${TABLE}\` WHERE \`id\` = ? AND \`client_id\` = ? LIMIT 1`;
  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, [String(callId), String(clientId)]);
  return (rows[0] as RawCallRow) || null;
}

export async function fetchTrendRows(opts: RepositoryQueryOptions): Promise<any[]> {
  const limit = safeLimit(opts.limit, MAX_QUERY_ROWS);
  const params: string[] = [String(opts.clientId)];
  let sql = `SELECT ${cols(TREND_COLUMNS)} FROM \`${TABLE}\` WHERE \`client_id\` = ?`;

  if (opts.fromDate) { sql += ' AND `CallDate` >= ?'; params.push(opts.fromDate); }
  if (opts.toDate) { sql += ' AND `CallDate` <= ?'; params.push(opts.toDate); }
  if (opts.agentName) { sql += ' AND `AgentName` = ?'; params.push(opts.agentName); }

  sql += ` ORDER BY \`CallDate\` ASC LIMIT ${limit}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows;
}

export async function fetchTNIRows(opts: RepositoryQueryOptions): Promise<any[]> {
  const limit = safeLimit(opts.limit, MAX_QUERY_ROWS);
  const params: string[] = [String(opts.clientId)];
  let sql = `SELECT ${cols(TNI_COLUMNS)} FROM \`${TABLE}\` WHERE \`client_id\` = ?`;

  if (opts.fromDate) { sql += ' AND `CallDate` >= ?'; params.push(opts.fromDate); }
  if (opts.toDate) { sql += ' AND `CallDate` <= ?'; params.push(opts.toDate); }

  sql += ` ORDER BY \`CallDate\` DESC LIMIT ${limit}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows;
}

export async function fetchRiskRows(opts: RepositoryQueryOptions): Promise<any[]> {
  const limit = safeLimit(opts.limit, MAX_RISK_ROWS);
  const params: string[] = [String(opts.clientId)];
  let sql = `SELECT ${cols(RISK_COLUMNS)} FROM \`${TABLE}\` WHERE \`client_id\` = ? AND \`Snapmint_Pitch\` IN ('High','Critical','Medium')`;

  if (opts.fromDate) { sql += ' AND `CallDate` >= ?'; params.push(opts.fromDate); }
  if (opts.toDate) { sql += ' AND `CallDate` <= ?'; params.push(opts.toDate); }

  sql += ` ORDER BY \`CallDate\` DESC LIMIT ${limit}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows;
}

// ─── Sensitive word analytics (db_external, read-only, guarded) ─────────────
//
// Returns rows where any sensitive-word signal is non-empty. The engine layer
// is responsible for tokenising pipe-delimited multi-word values and aggregating
// counts; this function only guarantees a safe, bounded SELECT.

export async function fetchSensitiveWordRows(opts: RepositoryQueryOptions): Promise<any[]> {
  const limit = safeLimit(opts.limit, MAX_SENSITIVE_ROWS);
  const params: string[] = [String(opts.clientId)];
  // Filter rows where any of the sensitive-word signals is non-empty.
  // `OR` with TRIM/NOT IN ('no','n/a','none') to exclude empty/placeholder values.
  let sql = `
    SELECT ${cols(SENSITIVE_WORD_COLUMNS)}
    FROM \`${TABLE}\`
    WHERE \`client_id\` = ?
      AND (
        (SensitiveWordUsed IS NOT NULL
          AND TRIM(SensitiveWordUsed) <> ''
          AND LOWER(TRIM(SensitiveWordUsed)) NOT IN ('no','n/a','na','none','not available'))
        OR (TopNegativeWordsByAgent IS NOT NULL
          AND TRIM(TopNegativeWordsByAgent) <> ''
          AND LOWER(TRIM(TopNegativeWordsByAgent)) NOT IN ('no','n/a','na','none','not available'))
        OR (TopNegativeWordsByCustomer IS NOT NULL
          AND TRIM(TopNegativeWordsByCustomer) <> ''
          AND LOWER(TRIM(TopNegativeWordsByCustomer)) NOT IN ('no','n/a','na','none','not available'))
      )`;

  if (opts.fromDate) { sql += ' AND `CallDate` >= ?'; params.push(opts.fromDate); }
  if (opts.toDate)   { sql += ' AND `CallDate` <= ?'; params.push(opts.toDate); }
  if (opts.agentName) { sql += ' AND `AgentName` = ?'; params.push(opts.agentName); }

  sql += ` ORDER BY \`CallDate\` DESC LIMIT ${limit}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows;
}

export async function fetchAnalystSummary(opts: RepositoryQueryOptions): Promise<any[]> {
  const params: string[] = [String(opts.clientId)];
  let sql = `
    SELECT
      AgentName,
      COUNT(*) AS totalCalls,
      SUM(CASE WHEN Feedback_Category REGEXP '^[0-9]+(\\\\.[0-9]+)?$' AND CAST(Feedback_Category AS DECIMAL) > 0 THEN 1 ELSE 0 END) AS scoredCalls,
      AVG(CASE WHEN Feedback_Category REGEXP '^[0-9]+(\\\\.[0-9]+)?$' AND CAST(Feedback_Category AS DECIMAL) > 0 THEN CAST(Feedback_Category AS DECIMAL) ELSE NULL END) AS avgScore,
      SUM(CASE WHEN PrepaidPitch = '1' THEN 1 ELSE 0 END) AS pitchAttempts,
      SUM(CASE WHEN UpsellingEfforts = 'Strong' THEN 1 ELSE 0 END) AS strongPitch,
      SUM(CASE WHEN Snapmint_Pitch IN ('High','Critical') THEN 1 ELSE 0 END) AS highRiskCount,
      SUM(CASE WHEN ConsumptionType IN ('Sales','Mixed') THEN 1 ELSE 0 END) AS opportunities,
      SUM(CASE WHEN SaleDone = '1' THEN 1 ELSE 0 END) AS disbursals,
      MAX(CallDate) AS lastCallDate
    FROM \`${TABLE}\`
    WHERE client_id = ?`;

  if (opts.fromDate) { sql += ' AND CallDate >= ?'; params.push(opts.fromDate); }
  if (opts.toDate) { sql += ' AND CallDate <= ?'; params.push(opts.toDate); }

  sql += ` GROUP BY AgentName ORDER BY avgScore ASC LIMIT ${MAX_ANALYST_GROUPS}`;

  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, params);
  return rows;
}

export async function countClientRows(clientId: string): Promise<number> {
  const sql = `SELECT COUNT(*) AS total FROM \`${TABLE}\` WHERE \`client_id\` = ?`;
  assertSelectOnly(sql);
  const [rows] = await dbExternalPool.execute<any[]>(sql, [String(clientId)]);
  return Number(rows[0]?.total || 0);
}

// ─── Agent name mapping (uses Shivamgiri pool, NOT dbExternalPool) ───────────

export async function fetchAgentNameMap(): Promise<Record<string, string>> {
  const sql = 'SELECT employee_code, agent_name FROM ci_agent_master WHERE active_status = 1';
  assertSelectOnly(sql);
  try {
    const [rows] = await pool.execute<any[]>(sql);
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.employee_code && r.agent_name && r.agent_name !== r.employee_code) {
        map[String(r.employee_code).trim()] = String(r.agent_name).trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}
