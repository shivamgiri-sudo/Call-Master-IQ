/**
 * Phase 2 Runtime Smoke Test Script
 * Tests all 15 Phase 2 analytics extension endpoints.
 * Does NOT log JWT, password, or full Authorization header.
 *
 * Data-status taxonomy (post Phase 2 Task 3 closure):
 *   NON_EMPTY      — endpoint returned real data (counts, lists, structures)
 *   SUPPORTED_FALSE— endpoint returned { data: { supported: false, reason: '...' } }
 *                    This is an honest contract for endpoints whose underlying
 *                    views don't expose required columns. Treated as a separate
 *                    status, NOT collapsed into "non-empty".
 *   EMPTY          — endpoint returned an empty data object/array
 *   SKIPPED        — auth preflight failed; this endpoint was not exercised
 *   ERROR          — endpoint returned HTTP 5xx or network failure
 *
 * Login contract (qaAuthController.ts):
 *   POST /api/qa-auth/login { login_id, password }
 *   Response: { success: true, token, user: {...} }  ← token at top level, not data.token
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5050';
const ADMIN_LOGIN = process.env.SMOKE_ADMIN_LOGIN_ID || process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;
const BEARER_TOKEN = process.env.SMOKE_BEARER_TOKEN;

type DataStatus = 'NON_EMPTY' | 'SUPPORTED_FALSE' | 'EMPTY' | 'SKIPPED' | 'ERROR';

interface TestResult {
  endpoint: string;
  method: string;
  status: number | 'NOT_RUN_AUTH_FAILED';
  httpOk: boolean;                  // true iff 2xx
  dataStatus: DataStatus;
  success?: boolean;
  code?: string;
  message?: string;
  supportedReason?: string;         // present iff dataStatus === 'SUPPORTED_FALSE'
  metaSource?: string;
  metaFrom?: string;
  metaTo?: string;
  metaTotalMs?: number;
  error?: string;
}

function classifyDataStatus(data: any, httpOk: boolean): DataStatus {
  if (!httpOk) return 'ERROR';
  if (!data || typeof data !== 'object') return 'EMPTY';
  if (data.supported === false) return 'SUPPORTED_FALSE';
  // Empty object/array
  if (Array.isArray(data)) return data.length === 0 ? 'EMPTY' : 'NON_EMPTY';
  if (Object.keys(data).length === 0) return 'EMPTY';
  return 'NON_EMPTY';
}

async function acquireToken(): Promise<string | null> {
  // If a pre-issued token is provided, skip login entirely
  if (BEARER_TOKEN) {
    console.log('Auth preflight: using SMOKE_BEARER_TOKEN (login skipped)');
    return BEARER_TOKEN;
  }

  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    console.error('❌ Missing SMOKE_ADMIN_LOGIN_ID/SMOKE_ADMIN_EMAIL or SMOKE_ADMIN_PASSWORD in .env');
    return null;
  }

  console.log(`Auth preflight: logging in as ${ADMIN_LOGIN}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/qa-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: ADMIN_LOGIN, password: ADMIN_PASSWORD }),
    });
  } catch (err: any) {
    console.error(`Auth preflight: FAIL — network error: ${err.message}`);
    return null;
  }

  let body: any = {};
  try {
    body = await response.json();
  } catch {
    console.error(`Auth preflight: FAIL — non-JSON response, status ${response.status}`);
    return null;
  }

  if (!response.ok) {
    // Print sanitized error body — never print password or token
    const sanitized = { success: body.success, message: body.message, status: response.status };
    console.error(`Auth preflight: FAIL — ${response.status} ${response.statusText}`);
    console.error(`Auth preflight: server response: ${JSON.stringify(sanitized)}`);
    return null;
  }

  // qaAuthController returns { success, token, user } at root — NOT { data: { token } }
  const token = body.token;
  if (!token) {
    console.error(`Auth preflight: FAIL — login succeeded but token missing in response`);
    console.error(`Auth preflight: response keys: ${Object.keys(body).join(', ')}`);
    return null;
  }

  console.log('Auth preflight: PASS');
  return token;
}

async function testEndpoint(
  method: string,
  endpointPath: string,
  token: string,
  params?: Record<string, string>,
  body?: any
): Promise<TestResult> {
  const url = new URL(`${BASE_URL}${endpointPath}`);
  if (params) {
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), options);
    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    const httpOk = response.status >= 200 && response.status < 300;
    // data lives under data.data per standard envelope
    const dataPayload = data && typeof data === 'object' ? data.data : undefined;
    const dataStatus = classifyDataStatus(dataPayload, httpOk);

    return {
      endpoint: endpointPath,
      method,
      status: response.status,
      httpOk,
      dataStatus,
      success: data.success,
      code: data.code,
      message: data.message,
      supportedReason: dataStatus === 'SUPPORTED_FALSE' ? dataPayload?.reason : undefined,
      metaSource: data.meta?.source,
      metaFrom: data.meta?.from,
      metaTo: data.meta?.to,
      metaTotalMs: data.meta?.totalMs,
    };
  } catch (err: any) {
    return {
      endpoint: endpointPath,
      method,
      status: 0,
      httpOk: false,
      dataStatus: 'ERROR',
      error: err.message,
    };
  }
}

function notRunResult(endpointPath: string, method: string): TestResult {
  return {
    endpoint: endpointPath,
    method,
    status: 'NOT_RUN_AUTH_FAILED',
    httpOk: false,
    dataStatus: 'SKIPPED',
  };
}

function statusEmoji(s: DataStatus): string {
  switch (s) {
    case 'NON_EMPTY':       return '✅ Non-empty';
    case 'SUPPORTED_FALSE': return '⚠ Supported-false';
    case 'EMPTY':           return '❌ Empty';
    case 'SKIPPED':         return '⏭ Skipped';
    case 'ERROR':           return '🔥 Error';
  }
}

function writeReport(results: TestResult[], authPassed: boolean, from: string, to: string) {
  let output = `# Phase 2 Runtime Smoke Test Results\n\n`;
  output += `**Generated:** ${new Date().toISOString()}\n`;
  output += `**Base URL:** ${BASE_URL}\n`;
  output += `**Test User:** ${ADMIN_LOGIN || '(SMOKE_BEARER_TOKEN)'}\n`;
  output += `**Date Range:** ${from} to ${to}\n`;
  output += `**Auth Preflight:** ${authPassed ? '✅ PASS' : '❌ FAIL'}\n\n`;
  output += `**Data-Status Taxonomy:** NON_EMPTY = real data returned · SUPPORTED_FALSE = \\`{supported:false, reason:'…'}\\` (honest contract) · EMPTY = empty payload · SKIPPED = auth failed · ERROR = 5xx/network\n\n`;
  output += `---\n\n`;

  // Summary stats
  const counts: Record<DataStatus, number> = {
    NON_EMPTY: 0, SUPPORTED_FALSE: 0, EMPTY: 0, SKIPPED: 0, ERROR: 0,
  };
  results.forEach(r => { counts[r.dataStatus]++; });
  const liveCount = counts.NON_EMPTY;
  const honestCount = counts.SUPPORTED_FALSE;
  const problemCount = counts.EMPTY + counts.ERROR + counts.SKIPPED;

  output += `## Summary\n\n`;
  output += `| Metric | Count |\n|---|---|\n`;
  output += `| Total endpoints tested | ${results.length} |\n`;
  output += `| ✅ Real data (LIVE) | ${liveCount} |\n`;
  output += `| ⚠ Supported-false (honest fallback) | ${honestCount} |\n`;
  output += `| ❌ Empty payload | ${counts.EMPTY} |\n`;
  output += `| 🔥 Error | ${counts.ERROR} |\n`;
  output += `| ⏭ Skipped (auth failed) | ${counts.SKIPPED} |\n`;
  output += `| **Problem total** | **${problemCount}** |\n\n`;

  output += `## Per-Endpoint Results\n\n`;
  output += `| # | Endpoint | Method | HTTP | Success | Source | Data Status | Total ms |\n`;
  output += `|---|----------|--------|------|---------|--------|-------------|----------|\n`;
  results.forEach((r, i) => {
    output += `| ${i + 1} | ${r.endpoint} | ${r.method} | ${r.status} | ${r.success ?? 'N/A'} | ${r.metaSource ?? 'N/A'} | ${statusEmoji(r.dataStatus)} | ${r.metaTotalMs ?? 'N/A'} |\n`;
  });

  output += `\n## Detailed Results\n\n`;
  results.forEach((r, i) => {
    output += `### ${i + 1}. ${r.method} ${r.endpoint}\n\n`;
    output += `- **Status:** ${r.status}\n`;
    output += `- **HTTP OK:** ${r.httpOk ? '✅' : '❌'}\n`;
    output += `- **Data Status:** ${r.dataStatus}\n`;
    if (r.success !== undefined) output += `- **Success:** ${r.success}\n`;
    if (r.code) output += `- **Code:** ${r.code}\n`;
    if (r.message) output += `- **Message:** ${r.message}\n`;
    if (r.supportedReason) output += `- **Supported-False Reason:** ${r.supportedReason}\n`;
    if (r.metaSource) output += `- **Source:** ${r.metaSource}\n`;
    if (r.metaFrom) output += `- **From:** ${r.metaFrom}\n`;
    if (r.metaTo) output += `- **To:** ${r.metaTo}\n`;
    if (r.metaTotalMs) output += `- **Total ms:** ${r.metaTotalMs}\n`;
    if (r.error) output += `- **Error:** ${r.error}\n`;
    output += `\n`;
  });

  const outputPath = path.join(process.cwd(), 'docs', 'phase2-runtime-smoke-results.md');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`\n✅ Results written to: ${outputPath}`);

  // Exit code policy: only ERROR or non-200 HTTP causes non-zero exit.
  // SUPPORTED_FALSE is an explicit, contract-compliant response.
  const nonZero = results.some(r =>
    r.dataStatus === 'ERROR' || (typeof r.status === 'number' && !r.httpOk && r.status !== 0)
  );
  if (nonZero) process.exitCode = 1;
}

async function main() {
  console.log('Phase 2 Runtime Smoke Tests');
  console.log(`Base URL: ${BASE_URL}`);

  // Use 30-day range within 90-day limit (max range for analytics)
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];
  const finnableParams = { client_id: '497', from: fromStr, to: toStr };

  const ENDPOINTS: Array<{ method: string; path: string; params?: Record<string, string>; body?: any }> = [
    { method: 'GET',  path: '/api/analytics/split-kpis',          params: finnableParams },
    { method: 'GET',  path: '/api/analytics/sales-intelligence',   params: finnableParams },
    { method: 'GET',  path: '/api/analytics/sales-funnel',         params: finnableParams },
    { method: 'GET',  path: '/api/analytics/leakage-report',       params: finnableParams },
    { method: 'GET',  path: '/api/analytics/risk-queue',           params: { ...finnableParams, page: '1', limit: '10' } },
    { method: 'GET',  path: '/api/analytics/tni-heatmap',          params: finnableParams },
    { method: 'POST', path: '/api/analytics/drilldown',            body: { client_id: '497', from: fromStr, to: toStr, dimension: 'risk', value: 'High Priority Risk Trigger', page: 1, limit: 10 } },
    { method: 'GET',  path: '/api/analytics/compliance-summary',   params: finnableParams },
    { method: 'GET',  path: '/api/analytics/journey-summary',      params: finnableParams },
    { method: 'GET',  path: '/api/analytics/quality-distribution', params: finnableParams },
    { method: 'GET',  path: '/api/analytics/top-bottom-agents',    params: { ...finnableParams, page: '1', limit: '10' } },
    { method: 'GET',  path: '/api/analytics/sensitive-words',      params: finnableParams },
    { method: 'GET',  path: '/api/analytics/risk-by-process',      params: finnableParams },
    { method: 'GET',  path: '/api/analytics/analyst-daily-trend',  params: finnableParams },
    { method: 'GET',  path: '/api/analytics/parameter-trend',      params: finnableParams },
  ];

  const token = await acquireToken();

  if (!token) {
    console.error('\n❌ Auth preflight FAILED — all endpoint tests skipped');
    const results = ENDPOINTS.map(e => notRunResult(e.path, e.method));
    writeReport(results, false, fromStr, toStr);
    process.exitCode = 1;
    return;
  }

  console.log(`\nTesting 15 endpoints with client_id=497, from=${fromStr}, to=${toStr}\n`);

  const results: TestResult[] = [];
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const e = ENDPOINTS[i];
    console.log(`${i + 1}. ${e.method} ${e.path}`);
    results.push(await testEndpoint(e.method, e.path, token, e.params, e.body));
  }

  writeReport(results, true, fromStr, toStr);

  const failCount = results.filter(r => typeof r.status === 'number' && r.status !== 200).length;
  const errorCount = results.filter(r => r.dataStatus === 'ERROR').length;
  console.log(`\nResults: ${results.length} tests, ${failCount} non-200, ${errorCount} errors`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exitCode = 1;
});