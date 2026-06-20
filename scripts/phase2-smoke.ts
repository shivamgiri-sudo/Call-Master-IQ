/**
 * Phase 2 Runtime Smoke Test Script
 * Tests all 15 Phase 2 analytics extension endpoints.
 * Does NOT log JWT, password, or full Authorization header.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5050';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
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

async function login(email: string, password: string): Promise<string> {
  console.log(`\nLogging in as: ${email}`);
  const response = await fetch(`${BASE_URL}/api/qa-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  if (!data.success || !data.data?.token) {
    throw new Error(`Login response missing token: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Login successful`);
  return data.data.token;
}

async function testEndpoint(
  method: string,
  path: string,
  token: string,
  params?: Record<string, string>,
  body?: any
): Promise<TestResult> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
  }

  const options: any = {
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
      endpoint: path,
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
      endpoint: path,
      method,
      status: 0,
      error: err.message,
      dataEmpty: true,
    };
  }
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Missing SMOKE_ADMIN_EMAIL or SMOKE_ADMIN_PASSWORD in .env');
    process.exit(1);
  }

  console.log('Phase 2 Runtime Smoke Tests');
  console.log(`Base URL: ${BASE_URL}`);

  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const results: TestResult[] = [];

  // Known date range where Finnable data should exist (adjust as needed)
  const from = '2024-01-01';
  const to = '2024-12-31';
  const finnableParams = { client_id: '497', from, to };

  console.log(`\n📊 Testing 15 endpoints with client_id=497, from=${from}, to=${to}\n`);

  // 1. GET /api/analytics/split-kpis
  console.log('1. GET /split-kpis');
  results.push(await testEndpoint('GET', '/api/analytics/split-kpis', token, finnableParams));

  // 2. GET /api/analytics/sales-intelligence
  console.log('2. GET /sales-intelligence');
  results.push(await testEndpoint('GET', '/api/analytics/sales-intelligence', token, finnableParams));

  // 3. GET /api/analytics/sales-funnel
  console.log('3. GET /sales-funnel');
  results.push(await testEndpoint('GET', '/api/analytics/sales-funnel', token, finnableParams));

  // 4. GET /api/analytics/leakage-report
  console.log('4. GET /leakage-report');
  results.push(await testEndpoint('GET', '/api/analytics/leakage-report', token, finnableParams));

  // 5. GET /api/analytics/risk-queue
  console.log('5. GET /risk-queue');
  results.push(await testEndpoint('GET', '/api/analytics/risk-queue', token, { ...finnableParams, page: '1', limit: '10' }));

  // 6. GET /api/analytics/tni-heatmap
  console.log('6. GET /tni-heatmap');
  results.push(await testEndpoint('GET', '/api/analytics/tni-heatmap', token, finnableParams));

  // 7. POST /api/analytics/drilldown
  console.log('7. POST /drilldown');
  results.push(await testEndpoint('POST', '/api/analytics/drilldown', token, undefined, { client_id: '497', from, to, dimension: 'risk', value: 'High Priority Risk Trigger', page: 1, limit: 10 }));

  // 8. GET /api/analytics/compliance-summary
  console.log('8. GET /compliance-summary');
  results.push(await testEndpoint('GET', '/api/analytics/compliance-summary', token, finnableParams));

  // 9. GET /api/analytics/journey-summary
  console.log('9. GET /journey-summary');
  results.push(await testEndpoint('GET', '/api/analytics/journey-summary', token, finnableParams));

  // 10. GET /api/analytics/quality-distribution
  console.log('10. GET /quality-distribution');
  results.push(await testEndpoint('GET', '/api/analytics/quality-distribution', token, finnableParams));

  // 11. GET /api/analytics/top-bottom-agents
  console.log('11. GET /top-bottom-agents');
  results.push(await testEndpoint('GET', '/api/analytics/top-bottom-agents', token, { ...finnableParams, page: '1', limit: '10' }));

  // 12. GET /api/analytics/sensitive-words
  console.log('12. GET /sensitive-words');
  results.push(await testEndpoint('GET', '/api/analytics/sensitive-words', token, finnableParams));

  // 13. GET /api/analytics/risk-by-process
  console.log('13. GET /risk-by-process');
  results.push(await testEndpoint('GET', '/api/analytics/risk-by-process', token, finnableParams));

  // 14. GET /api/analytics/analyst-daily-trend
  console.log('14. GET /analyst-daily-trend');
  results.push(await testEndpoint('GET', '/api/analytics/analyst-daily-trend', token, finnableParams));

  // 15. GET /api/analytics/parameter-trend
  console.log('15. GET /parameter-trend');
  results.push(await testEndpoint('GET', '/api/analytics/parameter-trend', token, finnableParams));

  // Generate report
  let output = `# Phase 2 Runtime Smoke Test Results\n\n`;
  output += `**Generated:** ${new Date().toISOString()}\n`;
  output += `**Base URL:** ${BASE_URL}\n`;
  output += `**Test User:** ${ADMIN_EMAIL}\n`;
  output += `**Date Range:** ${from} to ${to}\n\n`;
  output += `---\n\n`;

  output += `## Summary\n\n`;
  output += `| # | Endpoint | Method | Status | Success | Source | Data | Total ms |\n`;
  output += `|---|----------|--------|--------|---------|--------|------|----------|\n`;
  results.forEach((r, i) => {
    const dataStatus = r.dataEmpty ? '❌ Empty' : '✅ Non-empty';
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
  console.log(`\n✅ Smoke test results written to: ${outputPath}`);

  const failCount = results.filter(r => r.status !== 200 && r.status !== 0).length;
  const errorCount = results.filter(r => r.error).length;
  console.log(`\n📊 Results: ${results.length} tests, ${failCount} non-200, ${errorCount} errors`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
