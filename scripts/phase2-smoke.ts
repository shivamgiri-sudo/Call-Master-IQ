/**
 * Phase 2 Runtime Smoke Test Script
 * Tests all 15 Phase 2 analytics extension endpoints.
 * Does NOT log JWT, password, or full Authorization header.
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

interface TestResult {
  endpoint: string;
  method: string;
  status: number | 'NOT_RUN_AUTH_FAILED';
  success?: boolean;
  code?: string;
  message?: string;
  metaSource?: string;
  metaFrom?: string;
  metaTo?: string;
  metaTotalMs?: number;
  dataEmpty: boolean;
  error?: string;
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

    return {
      endpoint: endpointPath,
      method,
      status: response.status,
      success: data.success,
      code: data.code,
      message: data.message,
      metaSource: data.meta?.source,
      metaFrom: data.meta?.from,
      metaTo: data.meta?.to,
      metaTotalMs: data.meta?.totalMs,
      dataEmpty: !data.data || (typeof data.data === 'object' && Object.keys(data.data).length === 0),
    };
  } catch (err: any) {
    return {
      endpoint: endpointPath,
      method,
      status: 0,
      error: err.message,
      dataEmpty: true,
    };
  }
}

function notRunResult(endpointPath: string, method: string): TestResult {
  return {
    endpoint: endpointPath,
    method,
    status: 'NOT_RUN_AUTH_FAILED',
    dataEmpty: true,
  };
}

function writeReport(results: TestResult[], authPassed: boolean, from: string, to: string) {
  let output = `# Phase 2 Runtime Smoke Test Results\n\n`;
  output += `**Generated:** ${new Date().toISOString()}\n`;
  output += `**Base URL:** ${BASE_URL}\n`;
  output += `**Test User:** ${ADMIN_LOGIN || '(SMOKE_BEARER_TOKEN)'}\n`;
  output += `**Date Range:** ${from} to ${to}\n`;
  output += `**Auth Preflight:** ${authPassed ? '✅ PASS' : '❌ FAIL'}\n\n`;
  output += `---\n\n`;

  output += `## Summary\n\n`;
  output += `| # | Endpoint | Method | Status | Success | Source | Data | Total ms |\n`;
  output += `|---|----------|--------|--------|---------|--------|------|----------|\n`;
  results.forEach((r, i) => {
    const dataStatus = r.status === 'NOT_RUN_AUTH_FAILED'
      ? '⏭ Skipped'
      : r.dataEmpty ? '❌ Empty' : '✅ Non-empty';
    output += `| ${i + 1} | ${r.endpoint} | ${r.method} | ${r.status} | ${r.success ?? 'N/A'} | ${r.metaSource ?? 'N/A'} | ${dataStatus} | ${r.metaTotalMs ?? 'N/A'} |\n`;
  });

  output += `\n## Detailed Results\n\n`;
  results.forEach((r, i) => {
    output += `### ${i + 1}. ${r.method} ${r.endpoint}\n\n`;
    output += `- **Status:** ${r.status}\n`;
    output += `- **Success:** ${r.success ?? 'N/A'}\n`;
    if (r.code) output += `- **Code:** ${r.code}\n`;
    if (r.message) output += `- **Message:** ${r.message}\n`;
    if (r.metaSource) output += `- **Source:** ${r.metaSource}\n`;
    if (r.metaFrom) output += `- **From:** ${r.metaFrom}\n`;
    if (r.metaTo) output += `- **To:** ${r.metaTo}\n`;
    if (r.metaTotalMs) output += `- **Total ms:** ${r.metaTotalMs}\n`;
    output += `- **Data empty:** ${r.dataEmpty}\n`;
    if (r.error) output += `- **Error:** ${r.error}\n`;
    output += `\n`;
  });

  const outputPath = path.join(process.cwd(), 'docs', 'phase2-runtime-smoke-results.md');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`\n✅ Results written to: ${outputPath}`);
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
  const errorCount = results.filter(r => r.error).length;
  console.log(`\nResults: ${results.length} tests, ${failCount} non-200, ${errorCount} errors`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exitCode = 1;
});
