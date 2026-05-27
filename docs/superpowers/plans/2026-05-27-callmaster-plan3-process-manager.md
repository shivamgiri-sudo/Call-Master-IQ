# Call Master Dashboard — Plan 3: Process Manager

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 17 Process Manager API endpoints and all 15+ frontend pages — 8 shared (Inbound+Outbound), 4 Inbound-only (Fatal Analysis, Scenario, Detail Analysis, Escalation), and 5 Outbound-only (CST/CRT Funnel, MOA, NPS/CSAT, Pitch Stage, Objection Rebuttal).

**Architecture:** `processService.ts` handles all PM queries. Inbound-only pages query `db_audit.call_quality_assessment` + `manual_qa_audit` via the inbound KPI view. Outbound-only pages query `db_external.CallDetails`. The frontend dynamically hides/shows Inbound or Outbound sections in the PM nav based on `state.user.process_ids` and the ProcessRegistry's `source_type`. `USE_MOCK_DATA=true` until real schemas are confirmed.

**Tech Stack:** TypeScript/Express 5, mysql2, vanilla JS, ApexCharts. Prereq: Plans 1 + 2 complete.

---

## File Map

### Backend — new files
```
src/callmaster/
  repositories/inboundRepo.ts       ← queries db_audit.call_quality_assessment + manual_qa_audit
  repositories/outboundRepo.ts      ← queries db_external.CallDetails detail
  services/processService.ts        ← all 17 PM endpoint implementations
  routes/pmRoutes.ts                ← POST /api/callmaster/pm/*
```

### Backend — modified
```
src/server.ts                       ← mount pmRoutes
```

### Frontend — modified
```
public/callmaster/js/pages/pm.js    ← replace stubs with 15 full page renderers
```

---

## Task 1: Inbound Repository

**Files:**
- Create: `src/callmaster/repositories/inboundRepo.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/repositories/inboundRepo.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, paginationClause, Preset, PaginationParams } from './baseRepository';

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function getInboundCallDetail(callId: string) {
  const rows = await q(`
    SELECT cqa.*, mqa.*
    FROM db_audit.call_quality_assessment cqa
    LEFT JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = cqa.id
    WHERE cqa.id = ?
    LIMIT 1
  `, [callId]);
  return rows[0] || null;
}

export async function getInboundExplorer(opts: {
  processIds: string[]; preset: Preset; page: number; limit: number;
  agentCode?: string; scoreBand?: string; severity?: string; scenario?: string;
}) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const where: string[] = [`k.call_date BETWEEN ? AND ?`, pClause];
  const whereParams: any[] = [startDate, endDate, ...pParams];

  if (opts.agentCode) { where.push('k.agent_employee_code = ?'); whereParams.push(opts.agentCode); }
  if (opts.scoreBand) {
    const bandMap: Record<string, string> = {
      'Excellent': 'k.quality_score >= 98',
      'Good':      'k.quality_score >= 90 AND k.quality_score < 98',
      'Average':   'k.quality_score >= 85 AND k.quality_score < 90',
      'Below Average': 'k.quality_score < 85',
    };
    if (bandMap[opts.scoreBand]) where.push(bandMap[opts.scoreBand]);
  }
  if (opts.severity) { where.push('k.alert_severity = ?'); whereParams.push(opts.severity); }

  const whereClause = where.join(' AND ');
  const [[{ total }]] = await (db as any).execute<any[]>(
    `SELECT COUNT(*) AS total FROM v_call_master_inbound_kpi k WHERE ${whereClause}`,
    whereParams
  );

  const rows = await q(`
    SELECT k.source_call_id AS id, k.call_date, k.agent_employee_name AS agent,
           k.agent_employee_code, k.quality_score, k.quality_band, k.alert_severity,
           k.process_name, k.campaign_name
    FROM v_call_master_inbound_kpi k
    WHERE ${whereClause}
    ORDER BY k.call_date DESC, k.alert_severity DESC
    ${paginationClause({ page: opts.page, limit: opts.limit })}
  `, whereParams);

  return { total: Number(total), calls: rows };
}

export async function getFatalAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const [summary] = await q(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(is_critical_call) AS fatal_calls,
      ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatal_pct,
      ROUND(AVG(CASE WHEN is_critical_call = 0 THEN quality_score END), 2) AS without_fatal_cq
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND ${pClause}
  `, [startDate, endDate, ...pParams]);

  const contributors = await q(`
    SELECT agent_employee_name AS agent, COUNT(*) AS fatal_count
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND is_critical_call = 1 AND ${pClause}
    GROUP BY agent_employee_name
    ORDER BY fatal_count DESC
    LIMIT 10
  `, [startDate, endDate, ...pParams]);

  const dayWise = await q(`
    SELECT DATE(call_datetime) AS call_date,
           ROUND(SUM(is_critical_call) / COUNT(*) * 100, 2) AS fatal_pct
    FROM v_call_master_inbound_kpi
    WHERE call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY DATE(call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  // Scenario × fatal type matrix from manual_qa_audit
  const scenarioFatal = await q(`
    SELECT
      cqa.Scenario AS scenario,
      SUM(CASE WHEN LOWER(TRIM(mqa.data_theft_or_misuse))='yes' THEN 1 ELSE 0 END) AS data_theft,
      SUM(CASE WHEN LOWER(TRIM(mqa.financial_fraud))='yes' THEN 1 ELSE 0 END) AS financial_fraud,
      SUM(CASE WHEN LOWER(TRIM(mqa.escalation_failure))='yes' THEN 1 ELSE 0 END) AS escalation_failure,
      SUM(CASE WHEN LOWER(TRIM(mqa.unprofessional_behavior))='yes' THEN 1 ELSE 0 END) AS unprofessional,
      COUNT(*) AS total
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY cqa.Scenario
  `, [startDate, endDate, ...pParams]);

  return {
    fatal_pct:       Number(summary?.fatal_pct ?? 0),
    without_fatal_cq: Number(summary?.without_fatal_cq ?? 0),
    total_calls:     Number(summary?.total_calls ?? 0),
    fatal_calls:     Number(summary?.fatal_calls ?? 0),
    top_contributors: contributors,
    day_wise:         dayWise,
    scenario_fatal:   scenarioFatal,
  };
}

export async function getScenarioBreakdown(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  return q(`
    SELECT
      cqa.Scenario AS scenario,
      COUNT(*) AS total_calls,
      ROUND(AVG(k.quality_score), 2) AS avg_score,
      SUM(k.is_critical_call) AS fatal_count
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
      AND cqa.Scenario IS NOT NULL AND cqa.Scenario != ''
    GROUP BY cqa.Scenario
    ORDER BY total_calls DESC
  `, [startDate, endDate, ...pParams]);
}

export async function getDetailAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const agentScores = await q(`
    SELECT
      k.agent_employee_name AS name,
      k.agent_employee_code AS employee_code,
      COUNT(*) AS total_calls,
      ROUND(AVG(k.quality_score), 2) AS avg_score,
      SUM(k.is_critical_call) AS fatal_count,
      ROUND(AVG(mqa.opening_greeting), 3) AS opening,
      ROUND(AVG(mqa.compliance), 3) AS compliance,
      ROUND(AVG(mqa.resolution_provided), 3) AS resolution,
      ROUND(AVG(mqa.hold_procedure), 3) AS hold
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY k.agent_employee_code, k.agent_employee_name
    ORDER BY avg_score DESC
  `, [startDate, endDate, ...pParams]);

  // Add TQ/MQ/BQ classification
  return agentScores.map((r: any) => {
    let classification = 'MQ';
    if (r.avg_score >= 100) classification = 'TQ';       // target 95 + 5
    else if (r.avg_score >= 90) classification = 'TQ';
    else if (r.avg_score < 85) classification = 'BQ';
    return { ...r, classification };
  });
}

export async function getEscalationAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', opts.processIds);

  const [summary] = await q(`
    SELECT
      COUNT(*) AS potential_escalations,
      SUM(CASE WHEN LOWER(COALESCE(cqa.SocialMediaThreat,'')) = 'yes' THEN 1 ELSE 0 END) AS social_media_threat,
      SUM(CASE WHEN LOWER(COALESCE(cqa.ScamMention,'')) = 'yes' THEN 1 ELSE 0 END) AS scam_mentions,
      SUM(CASE WHEN LOWER(COALESCE(cqa.CompetitorMention,'')) = 'yes' THEN 1 ELSE 0 END) AS competitor_mentions
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
      AND (LOWER(COALESCE(cqa.SocialMediaThreat,''))='yes'
        OR LOWER(COALESCE(cqa.ScamMention,''))='yes'
        OR LOWER(COALESCE(cqa.CompetitorMention,''))='yes'
        OR LOWER(COALESCE(cqa.NegativeSentiment,''))='yes')
  `, [startDate, endDate, ...pParams]);

  const scamDayWise = await q(`
    SELECT DATE(k.call_datetime) AS call_date, COUNT(*) AS scam_count
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.call_quality_assessment cqa ON cqa.id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ?
      AND LOWER(COALESCE(cqa.ScamMention,''))='yes' AND ${pClause}
    GROUP BY DATE(k.call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  return {
    potential_escalations: Number(summary?.potential_escalations ?? 0),
    social_media_threat:   Number(summary?.social_media_threat ?? 0),
    scam_mentions:         Number(summary?.scam_mentions ?? 0),
    competitor_mentions:   Number(summary?.competitor_mentions ?? 0),
    scam_day_wise:         scamDayWise,
  };
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/repositories/inboundRepo.ts
git commit -m "feat(callmaster): add inbound repository (call detail, explorer, fatal analysis, scenario, escalation)"
```

---

## Task 2: Outbound Repository

**Files:**
- Create: `src/callmaster/repositories/outboundRepo.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/repositories/outboundRepo.ts
import dbExternalPool from '../../config/dbExternal';
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, paginationClause, Preset } from './baseRepository';

async function qExternal<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (dbExternalPool as any).execute<T[]>(sql, params);
  return rows;
}

async function qShivamgiri<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

// Get client_ids for given process names via process_mapping_master
async function clientIdsForProcesses(processIds: string[]): Promise<string[]> {
  if (processIds.includes('*')) return ['*'];
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', processIds);
  const rows = await qShivamgiri<any>(`SELECT dialdesk_client_id FROM process_mapping_master WHERE source_type='Outbound' AND ${pClause} AND active_status=1`, pParams);
  return rows.map((r: any) => String(r.dialdesk_client_id));
}

export async function getOutboundCallDetail(callId: string) {
  const rows = await qExternal(`SELECT * FROM CallDetails WHERE id = ? LIMIT 1`, [callId]);
  return rows[0] || null;
}

export async function getCstCrtFunnel(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const [row] = await qExternal(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(CASE WHEN PrepaidPitch = 'Success' THEN 1 ELSE 0 END) AS ops,
      SUM(CASE WHEN ContextPitch = 'Success' THEN 1 ELSE 0 END) AS cps,
      SUM(CASE WHEN OfferPitch   = 'Success' THEN 1 ELSE 0 END) AS offer_success,
      SUM(CASE WHEN Snapmint_Pitch = 'Sale Done' THEN 1 ELSE 0 END) AS sale_done,
      SUM(CASE WHEN PrepaidPitch = 'Rejected' THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN ContextPitch = 'Rejected' THEN 1 ELSE 0 END) AS cr_count,
      SUM(CASE WHEN OfferPitch   = 'Rejected' THEN 1 ELSE 0 END) AS opr_count,
      SUM(CASE WHEN PostOfferReject IS NOT NULL AND PostOfferReject != '' THEN 1 ELSE 0 END) AS por_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND ${cClause}
  `, [startDate, endDate, ...cParams]);

  const total = Number(row?.total_calls ?? 0);
  const saleDone = Number(row?.sale_done ?? 0);
  const totalRejected = Number(row?.or_count ?? 0) + Number(row?.cr_count ?? 0) + Number(row?.opr_count ?? 0) + Number(row?.por_count ?? 0);

  return {
    cst: {
      total_calls:   total,
      ops:           Number(row?.ops ?? 0),
      cps:           Number(row?.cps ?? 0),
      offer_success: Number(row?.offer_success ?? 0),
      sale_done:     saleDone,
      success_rate:  total > 0 ? +((saleDone / total) * 100).toFixed(2) : 0,
    },
    crt: {
      or_count:     Number(row?.or_count ?? 0),
      cr_count:     Number(row?.cr_count ?? 0),
      opr_count:    Number(row?.opr_count ?? 0),
      por_count:    Number(row?.por_count ?? 0),
      failure_rate: total > 0 ? +((totalRejected / total) * 100).toFixed(2) : 0,
    },
  };
}

export async function getMissedOpportunities(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const [[summary]] = await (dbExternalPool as any).execute<any[]>(`
    SELECT COUNT(*) AS total_opportunities,
           SUM(CASE WHEN Snapmint_Pitch NOT IN ('Sale Done','') AND Snapmint_Pitch IS NOT NULL THEN 1 ELSE 0 END) AS mo_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ? AND ${cClause}
  `, [startDate, endDate, ...cParams]);

  const categories = await qExternal(`
    SELECT
      Feedback_Category AS category,
      COUNT(*) AS count,
      ROUND(COUNT(*) / ? * 100, 1) AS contr_pct
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND Feedback_Category IS NOT NULL AND Feedback_Category != ''
      AND ${cClause}
    GROUP BY Feedback_Category
    ORDER BY count DESC
    LIMIT 10
  `, [Number(summary?.mo_count) || 1, startDate, endDate, ...cParams]);

  return {
    total_opportunities: Number(summary?.total_opportunities ?? 0),
    mo_count:            Number(summary?.mo_count ?? 0),
    categories:          categories.map((r: any) => ({
      ...r,
      observation: null,  // AI observations populated by call_ai_insight table in future
    })),
  };
}

export async function getNpsCsat(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  // NPS is derived from AI insights stored in call_ai_insight (Shivamgiri)
  const dayWise = await qShivamgiri(`
    SELECT
      DATE(k.call_datetime) AS call_date,
      COUNT(*) AS record_count,
      SUM(CASE WHEN i.nps_risk = 'Detractor' THEN 1 ELSE 0 END) AS detractor_count,
      SUM(CASE WHEN i.nps_risk = 'Passive'   THEN 1 ELSE 0 END) AS passive_count,
      SUM(CASE WHEN i.nps_risk = 'Promoter'  THEN 1 ELSE 0 END) AS promoter_count
    FROM v_call_master_outbound_kpi k
    INNER JOIN call_ai_insight i ON i.source_type = 'Outbound' AND i.source_call_id = CAST(k.source_call_id AS CHAR)
    WHERE k.call_date BETWEEN ? AND ?
    GROUP BY DATE(k.call_datetime)
    ORDER BY call_date
  `, [startDate, endDate]);

  const totals = dayWise.reduce((acc: any, r: any) => {
    acc.detractors += Number(r.detractor_count);
    acc.passives   += Number(r.passive_count);
    acc.promoters  += Number(r.promoter_count);
    acc.total      += Number(r.record_count);
    return acc;
  }, { detractors: 0, passives: 0, promoters: 0, total: 0 });

  const npsScore = totals.total > 0
    ? +((totals.promoters - totals.detractors) / totals.total * 100).toFixed(2)
    : 0;

  const csatScore = totals.total > 0
    ? +((totals.promoters + totals.passives) / totals.total * 100).toFixed(1)
    : 0;

  return {
    nps_score:   npsScore,
    csat_score:  csatScore,
    detractors:  totals.detractors,
    passives:    totals.passives,
    promoters:   totals.promoters,
    day_wise:    dayWise,
  };
}

export async function getPitchStageAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const opAnalysis = await qExternal(`
    SELECT
      PrepaidPitch AS op_category,
      COUNT(*) AS count,
      ROUND(SUM(CASE WHEN Snapmint_Pitch='Sale Done' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS success_rate
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND PrepaidPitch IS NOT NULL AND PrepaidPitch != ''
      AND ${cClause}
    GROUP BY PrepaidPitch
    ORDER BY count DESC
  `, [startDate, endDate, ...cParams]);

  const offeredPitch = await qExternal(`
    SELECT
      Pricing_and_Discount_Structure AS discount_type,
      COUNT(*) AS total_offered,
      SUM(CASE WHEN OfferPitch = 'Rejected' THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN OfferPitch = 'Success'  THEN 1 ELSE 0 END) AS os_count,
      SUM(CASE WHEN Snapmint_Pitch = 'Sale Done' THEN 1 ELSE 0 END) AS sale_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND Pricing_and_Discount_Structure IS NOT NULL AND Pricing_and_Discount_Structure != ''
      AND ${cClause}
    GROUP BY Pricing_and_Discount_Structure
    ORDER BY total_offered DESC
    LIMIT 20
  `, [startDate, endDate, ...cParams]);

  return {
    op_analysis: opAnalysis,
    offered_pitch: offeredPitch.map((r: any) => ({
      ...r,
      or_pct:         r.total_offered > 0 ? +((r.or_count / r.total_offered) * 100).toFixed(1) : 0,
      os_pct:         r.total_offered > 0 ? +((r.os_count / r.total_offered) * 100).toFixed(1) : 0,
      conversion_pct: r.total_offered > 0 ? +((r.sale_count / r.total_offered) * 100).toFixed(1) : 0,
    })),
  };
}

export async function getObjectionRebuttal(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const rows = await qExternal(`
    SELECT
      ObjectionHandling AS main_objection,
      Rebuttal AS agent_rebuttal,
      COUNT(*) AS objection_count,
      SUM(CASE WHEN Snapmint_Pitch = 'Sale Done' THEN 1 ELSE 0 END) AS successful_rebuttal,
      SUM(CASE WHEN Snapmint_Pitch != 'Sale Done' THEN 1 ELSE 0 END) AS failed_rebuttal
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND ObjectionHandling IS NOT NULL AND ObjectionHandling != ''
      AND ${cClause}
    GROUP BY ObjectionHandling, Rebuttal
    ORDER BY objection_count DESC
    LIMIT 30
  `, [startDate, endDate, ...cParams]);

  return rows.map((r: any) => ({
    ...r,
    failed_rebuttal_pct:     r.objection_count > 0 ? +((r.failed_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
    successful_rebuttal_pct: r.objection_count > 0 ? +((r.successful_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
    conversion_pct:          r.objection_count > 0 ? +((r.successful_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
  }));
}

export async function getOutboundExplorer(opts: {
  processIds: string[]; preset: Preset; page: number; limit: number;
  agentCode?: string; severity?: string;
}) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const rows = await qExternal(`
    SELECT id, DATE(CallDate) AS call_date, AgentName AS agent, LeadID AS lead_id,
           Snapmint_Pitch AS pitch_result, SensitiveWordUsed AS sensitive_word,
           ObjectionHandling AS objection
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ? AND ${cClause}
    ORDER BY CallDate DESC
    ${paginationClause({ page: opts.page, limit: opts.limit })}
  `, [startDate, endDate, ...cParams]);

  return { total: null, calls: rows };  // total skipped for performance on large outbound tables
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/repositories/outboundRepo.ts
git commit -m "feat(callmaster): add outbound repository (CST/CRT, MOA, NPS/CSAT, pitch stage, objection rebuttal)"
```

---

## Task 3: Process Service

**Files:**
- Create: `src/callmaster/services/processService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/services/processService.ts
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';
import { getAnalystLeaderboard } from '../repositories/unifiedKpiRepo';
import * as inbound from '../repositories/inboundRepo';
import * as outbound from '../repositories/outboundRepo';
import { getProcessConfig } from '../config/processRegistry';

interface Scope { processIds: string[]; branchIds: string[]; }

async function q<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute<T[]>(sql, params);
  return rows;
}

export async function pmOverview(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  const [row] = await q(`
    SELECT
      COUNT(*) AS total_calls,
      ROUND(AVG(quality_score), 2) AS quality_score,
      SUM(is_critical_call) AS critical_count,
      SUM(CASE WHEN quality_score < 85 THEN 1 ELSE 0 END) AS defect_count,
      source_type
    FROM v_call_master_unified_kpi
    WHERE call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY source_type
    LIMIT 1
  `, [startDate, endDate, ...pParams]);

  const target = await q(`
    SELECT COALESCE(target_cq_pct, CASE WHEN source_type='Inbound' THEN 95 ELSE 80 END) AS target_cq_pct, source_type
    FROM process_mapping_master WHERE ${pClause} AND active_status=1 LIMIT 1
  `, pParams);

  return {
    quality_score:  row?.quality_score ?? null,
    total_calls:    Number(row?.total_calls ?? 0),
    defect_count:   Number(row?.defect_count ?? 0),
    critical_count: Number(row?.critical_count ?? 0),
    source_type:    row?.source_type ?? 'Inbound',
    target_cq_pct:  Number(target[0]?.target_cq_pct ?? 95),
  };
}

export async function pmParameterBreakdown(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  // Inbound: from manual_qa_audit
  return q(`
    SELECT
      'opening_greeting' AS param, ROUND(AVG(mqa.opening_greeting) * 100, 1) AS pass_rate, 10 AS weight
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    UNION ALL
    SELECT 'compliance',   ROUND(AVG(mqa.compliance) * 100, 1), 15
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    UNION ALL
    SELECT 'resolution',   ROUND(AVG(mqa.resolution_provided) * 100, 1), 20
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    UNION ALL
    SELECT 'hold_procedure', ROUND(AVG(mqa.hold_procedure) * 100, 1), 10
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
  `, [startDate, endDate, ...pParams, startDate, endDate, ...pParams, startDate, endDate, ...pParams, startDate, endDate, ...pParams]);
}

export async function pmAnalystScorecard(preset: Preset, scope: Scope) {
  const rows = await getAnalystLeaderboard({ ...scope, preset });
  return rows.map((r: any) => {
    const target = r.source_type === 'Inbound' ? 95 : 80;
    let classification = 'MQ';
    if (r.avg_score >= target + 5) classification = 'TQ';
    else if (r.avg_score < target - 5) classification = 'BQ';
    return { ...r, classification };
  });
}

export async function pmTrends(scope: Scope) {
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return q(`
    SELECT call_date, COUNT(*) AS total_calls,
           ROUND(AVG(quality_score), 2) AS avg_score,
           SUM(is_critical_call) AS critical_count
    FROM v_call_master_unified_kpi
    WHERE call_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND ${pClause}
    GROUP BY call_date
    ORDER BY call_date
  `, pParams);
}

export async function pmExplorer(preset: Preset, scope: Scope, page = 1, limit = 50, filters: any = {}) {
  // Detect source type for this process
  const cfg = scope.processIds[0] !== '*'
    ? await getProcessConfig(scope.processIds[0])
    : null;

  if (cfg?.sourceType === 'Outbound') {
    return outbound.getOutboundExplorer({ processIds: scope.processIds, preset, page, limit, ...filters });
  }
  return inbound.getInboundExplorer({ processIds: scope.processIds, preset, page, limit, ...filters });
}

export async function pmCallDetail(callId: string, sourceType: 'Inbound' | 'Outbound') {
  if (sourceType === 'Outbound') return outbound.getOutboundCallDetail(callId);
  return inbound.getInboundCallDetail(callId);
}

export async function pmTniReport(preset: Preset, scope: Scope) {
  const { startDate, endDate } = presetToDateRange(preset);
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', scope.processIds);

  return q(`
    SELECT
      k.agent_employee_name AS agent,
      SUM(CASE WHEN mqa.opening_greeting < 1 THEN 1 ELSE 0 END) AS opening_defects,
      SUM(CASE WHEN mqa.compliance < 1 THEN 1 ELSE 0 END) AS compliance_defects,
      SUM(CASE WHEN mqa.resolution_provided < 1 THEN 1 ELSE 0 END) AS resolution_defects,
      SUM(CASE WHEN mqa.hold_procedure < 1 THEN 1 ELSE 0 END) AS hold_defects
    FROM v_call_master_inbound_kpi k
    INNER JOIN db_audit.manual_qa_audit mqa ON mqa.call_quality_assessment_id = k.source_call_id
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY k.agent_employee_name
    ORDER BY compliance_defects DESC
    LIMIT 30
  `, [startDate, endDate, ...pParams]);
}

// ── Inbound-only pass-throughs ──
export const pmFatalAnalysis     = (preset: Preset, scope: Scope) => inbound.getFatalAnalysis({ processIds: scope.processIds, preset });
export const pmScenarioBreakdown = (preset: Preset, scope: Scope) => inbound.getScenarioBreakdown({ processIds: scope.processIds, preset });
export const pmDetailAnalysis    = (preset: Preset, scope: Scope) => inbound.getDetailAnalysis({ processIds: scope.processIds, preset });
export const pmEscalationAnalysis= (preset: Preset, scope: Scope) => inbound.getEscalationAnalysis({ processIds: scope.processIds, preset });

// ── Outbound-only pass-throughs ──
export const pmCstCrtFunnel       = (preset: Preset, scope: Scope) => outbound.getCstCrtFunnel({ processIds: scope.processIds, preset });
export const pmMissedOpportunities= (preset: Preset, scope: Scope) => outbound.getMissedOpportunities({ processIds: scope.processIds, preset });
export const pmNpsCsat            = (preset: Preset, scope: Scope) => outbound.getNpsCsat({ processIds: scope.processIds, preset });
export const pmPitchStageAnalysis = (preset: Preset, scope: Scope) => outbound.getPitchStageAnalysis({ processIds: scope.processIds, preset });
export const pmObjectionRebuttal  = (preset: Preset, scope: Scope) => outbound.getObjectionRebuttal({ processIds: scope.processIds, preset });
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/callmaster/services/processService.ts
git commit -m "feat(callmaster): add process service (17 PM endpoints, Inbound/Outbound source-type routing)"
```

---

## Task 4: PM Routes

**Files:**
- Create: `src/callmaster/routes/pmRoutes.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/callmaster/routes/pmRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as pm from '../services/processService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'process_manager', 'tq_head'));

function scope(req: Request) {
  return { processIds: req.cm!.process_ids, branchIds: req.cm!.branch_ids };
}
function preset(req: Request): Preset {
  return (req.body?.preset as Preset) || 'MTD';
}

const wrap = (fn: Function) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

router.post('/overview',            wrap(req => pm.pmOverview(preset(req), scope(req))));
router.post('/parameter-breakdown', wrap(req => pm.pmParameterBreakdown(preset(req), scope(req))));
router.post('/analyst-scorecard',   wrap(req => pm.pmAnalystScorecard(preset(req), scope(req))));
router.post('/trends',              wrap(req => pm.pmTrends(scope(req))));
router.post('/tni-report',          wrap(req => pm.pmTniReport(preset(req), scope(req))));
router.post('/explorer',            wrap(req => pm.pmExplorer(
  preset(req), scope(req),
  Number(req.body?.page || 1), Number(req.body?.limit || 50), req.body?.filters || {}
)));
router.get('/call/:id',             wrap(req => pm.pmCallDetail(req.params.id, req.query.source_type as any || 'Inbound')));

// Inbound-only
router.post('/fatal-analysis',       wrap(req => pm.pmFatalAnalysis(preset(req), scope(req))));
router.post('/scenario-breakdown',   wrap(req => pm.pmScenarioBreakdown(preset(req), scope(req))));
router.post('/detail-analysis',      wrap(req => pm.pmDetailAnalysis(preset(req), scope(req))));
router.post('/escalation-analysis',  wrap(req => pm.pmEscalationAnalysis(preset(req), scope(req))));

// Outbound-only
router.post('/cst-crt-funnel',       wrap(req => pm.pmCstCrtFunnel(preset(req), scope(req))));
router.post('/missed-opportunities', wrap(req => pm.pmMissedOpportunities(preset(req), scope(req))));
router.post('/nps-csat',             wrap(req => pm.pmNpsCsat(preset(req), scope(req))));
router.post('/pitch-stage-analysis', wrap(req => pm.pmPitchStageAnalysis(preset(req), scope(req))));
router.post('/objection-rebuttal',   wrap(req => pm.pmObjectionRebuttal(preset(req), scope(req))));

export default router;
```

- [ ] **Step 2: Mount in server.ts**

Add to `src/server.ts` after the T&Q routes mount:

```typescript
import pmRoutes from './callmaster/routes/pmRoutes';
// ...
app.use('/api/callmaster/pm', pmRoutes);
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/callmaster/routes/pmRoutes.ts src/server.ts
git commit -m "feat(callmaster): add PM routes (17 endpoints — shared, Inbound-only, Outbound-only)"
```

---

## Task 5: PM Frontend — Shared pages

**Files:**
- Modify: `public/callmaster/js/pages/pm.js` (first 8 shared page renderers)

- [ ] **Step 1: Replace PM_PAGES with shared + Inbound + Outbound sections**

This is a long file — replace the **entire** contents of `public/callmaster/js/pages/pm.js`:

```javascript
// public/callmaster/js/pages/pm.js

const PM_PAGES = {

  // ══════════════════════════════════════════════
  // SHARED PAGES (Inbound + Outbound)
  // ══════════════════════════════════════════════

  'pm-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/overview', { preset });
    const d = r.data || {};
    const target = d.target_cq_pct || 95;
    setTimeout(() => {
      gaugeChart('pmScoreGauge', d.quality_score || 0, 100, `${d.quality_score || 0}%`, { color: (d.quality_score || 0) >= target ? '#06d6a0' : '#ef4444' });
    }, 0);
    return `
      ${pageHeader('Process Overview', `${d.source_type || ''} · Target: ${target}%`)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-overview')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Quality Score', d.quality_score ? d.quality_score + '%' : '—', `Target: ${target}%`, (d.quality_score || 0) >= target ? 'up' : 'down')}
        ${kpi('Total Calls',   Number(d.total_calls  || 0).toLocaleString())}
        ${kpi('Defects',       Number(d.defect_count || 0).toLocaleString(), 'Below 85%')}
        ${kpi('Critical',      Number(d.critical_count || 0).toLocaleString(), 'Severity: Critical+High', d.critical_count > 0 ? 'down' : 'up')}
      </div>
      <div class="card">
        <div class="chart-title">Quality Score</div>
        <div id="pmScoreGauge"></div>
      </div>`;
  },

  'pm-parameters': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/parameter-breakdown', { preset });
    const rows = r.data?.params || r.data || [];
    setTimeout(() => {
      barChart('pmParamChart',
        [{ name: 'Pass Rate %', data: rows.map(r => r.pass_rate) }],
        rows.map(r => r.param || r.process_name),
        { yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Parameter Breakdown', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-parameters')")}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Pass Rate by Parameter</div>
        <div class="chart-wrap" id="pmParamChart"></div>
      </div>
      ${table(
        [
          { key: 'param',     label: 'Parameter' },
          { key: 'weight',    label: 'Weight',    render: v => v != null ? `${v}%` : '—' },
          { key: 'pass_rate', label: 'Pass Rate', render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'trend',     label: 'Trend',     render: v => v === 'up' ? '▲' : v === 'down' ? '▼' : '—' },
        ],
        rows
      )}`;
  },

  'pm-explorer': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/explorer', { preset, page: 1, limit: 50 });
    const d = r.data || {};
    const calls = d.calls || [];
    return `
      ${pageHeader('Call Explorer', `${d.total != null ? Number(d.total).toLocaleString() + ' calls' : ''} · ${preset}`)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-explorer')")}
      </div>
      ${table(
        [
          { key: 'id',           label: 'Call ID',  render: v => `<span class="td-mono">${v}</span>` },
          { key: 'call_date',    label: 'Date' },
          { key: 'agent',        label: 'Agent' },
          { key: 'score',        label: 'CQ%',      render: (v, row) => {
            const s = v || row.quality_score;
            return s != null ? `<span class="td-mono">${s}%</span>` : '—';
          }},
          { key: 'band',         label: 'Band',     render: (v, row) => bandBadge(v || row.quality_band) },
          { key: 'severity',     label: 'Severity', render: (v, row) => sevBadge(v || row.alert_severity) },
          { key: 'pitch_result', label: 'Pitch',    render: v => v || '—' },
        ],
        calls,
        { emptyMsg: 'No calls found for selected filters' }
      )}`;
  },

  'pm-analyst-scorecard': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/analyst-scorecard', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Analyst Scorecard', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-analyst-scorecard')")}
      </div>
      ${table(
        [
          { key: 'name',          label: 'Analyst' },
          { key: 'avg_score',     label: 'Avg CQ%',   render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',   label: 'Calls',     render: v => Number(v || 0).toLocaleString() },
          { key: 'fatal_count',   label: 'Fatal',     render: v => Number(v || 0) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'classification',label: 'Class',     render: v => classificationBadge(v) },
          { key: 'critical_count',label: 'Critical',  render: v => v > 0 ? `<span class="sev-high">${v}</span>` : '0' },
        ],
        rows,
        { emptyMsg: 'No analyst data for period' }
      )}`;
  },

  'pm-tni': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/tni-report', { preset });
    const d = r.data;
    setTimeout(() => {
      if (d?.agents && d?.matrix) {
        const series = d.agents.map((agent, ai) => ({
          name: agent,
          data: d.params.map((p, pi) => ({ x: p, y: d.matrix[ai][pi] })),
        }));
        heatmapChart('pmTniHeatmap', series);
      } else if (Array.isArray(d) && d.length > 0) {
        const params = ['opening_defects','compliance_defects','resolution_defects','hold_defects'];
        const series = d.map(row => ({
          name: row.agent,
          data: params.map(p => ({ x: p.replace('_defects',''), y: Number(row[p] || 0) })),
        }));
        heatmapChart('pmTniHeatmap', series);
      }
    }, 0);
    return `
      ${pageHeader('TNI Report', 'Agent × Parameter defect matrix · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-tni')")}
      </div>
      <div class="card">
        <div class="chart-title">Training Need Index</div>
        <div id="pmTniHeatmap"></div>
      </div>`;
  },

  'pm-trends': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/trends', { preset });
    const rows = r.data || (r.categories ? r : []);
    setTimeout(() => {
      if (rows.series) {
        lineChart('pmTrendChart', rows.series, rows.categories, { yFormatter: v => v + '%' });
      } else {
        const cats = rows.map(r => r.call_date);
        lineChart('pmTrendChart',
          [{ name: 'CQ%', data: rows.map(r => Number(r.avg_score || 0)) }],
          cats, { yFormatter: v => v + '%' }
        );
        barChart('pmVolumeChart',
          [{ name: 'Calls', data: rows.map(r => Number(r.total_calls || 0)) }],
          cats
        );
      }
    }, 0);
    return `
      ${pageHeader('Daily Trends', '30-day quality + volume')}
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">Quality Score Trend</div>
          <div class="chart-wrap" id="pmTrendChart"></div>
        </div>
        <div class="card">
          <div class="chart-title">Call Volume</div>
          <div class="chart-wrap" id="pmVolumeChart"></div>
        </div>
      </div>`;
  },

  'pm-evidence': async function(preset) {
    return `
      ${pageHeader('Evidence Viewer', 'Search for a call to view evidence')}
      <div class="empty-state">
        <div class="empty-state-icon">🎧</div>
        <div class="empty-state-text">Enter a Call ID in the search bar or click a call from the Call Explorer</div>
      </div>`;
  },

  'pm-defect-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/parameter-breakdown', { preset });
    const params = r.data?.params || r.data || [];
    const defects = params.filter(p => (p.pass_rate || 0) < 90).sort((a, b) => a.pass_rate - b.pass_rate);
    setTimeout(() => {
      barChart('pmDefectChart',
        [{ name: 'Pass Rate %', data: defects.map(d => d.pass_rate) }],
        defects.map(d => d.param),
        { horizontal: true, yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Defect Analysis', 'Parameters below 90% pass rate · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-defect-analysis')")}
      </div>
      <div class="card">
        <div class="chart-title">Low-Performing Parameters</div>
        <div class="chart-wrap" id="pmDefectChart"></div>
      </div>`;
  },

  // ══════════════════════════════════════════════
  // INBOUND-ONLY PAGES
  // ══════════════════════════════════════════════

  'pm-fatal-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/fatal-analysis', { preset });
    const d = r.data || {};
    const dayWise = d.day_wise || [];
    const scenarioFatal = d.scenario_fatal || [];
    setTimeout(() => {
      lineChart('pmFatalTrendChart',
        [{ name: 'Fatal%', data: (dayWise.categories ? dayWise.fatal_pct : dayWise.map(d => d.fatal_pct)) }],
        (dayWise.categories || dayWise.map(d => d.call_date)),
        { yFormatter: v => v + '%', targetLine: 2 }
      );
      if (Array.isArray(scenarioFatal) && scenarioFatal.length > 0) {
        const fatalTypes = ['data_theft','financial_fraud','escalation_failure','unprofessional'];
        const series = scenarioFatal.map(row => ({
          name: row.scenario,
          data: fatalTypes.map(t => ({ x: t.replace('_', ' '), y: Number(row[t] || 0) })),
        }));
        heatmapChart('pmFatalHeatmap', series, { title: 'Scenario × Fatal Type' });
      }
    }, 0);
    return `
      ${pageHeader('Fatal Analysis', 'Inbound fatal call intelligence · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-fatal-analysis')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Fatal%',          (d.fatal_pct || 0) + '%', `${d.fatal_calls || 0} fatal calls`, 'down')}
        ${kpi('Without-Fatal CQ%', (d.without_fatal_cq || 0) + '%', 'Quality excl. fatal calls')}
        ${kpi('Total Calls',     Number(d.total_calls || 0).toLocaleString())}
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="chart-title">Day-wise Fatal% Trend</div>
          <div class="chart-wrap" id="pmFatalTrendChart"></div>
        </div>
        <div class="card">
          <div class="chart-title">Top 5 Fatal Contributors</div>
          ${table(
            [{ key:'agent', label:'Agent' },{ key:'fatal_count', label:'Count', render: v => `<span class="sev-critical td-mono">${v}</span>` }],
            (d.top_contributors || []).slice(0, 5)
          )}
        </div>
      </div>
      <div class="card">
        <div class="chart-title">Scenario × Fatal Type Heatmap</div>
        <div id="pmFatalHeatmap"></div>
      </div>`;
  },

  'pm-scenario': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/scenario-breakdown', { preset });
    const rows = r.data?.scenarios || r.data || [];
    return `
      ${pageHeader('Scenario Breakdown', 'Inbound: Query / Complaint / Request / Sale Done · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-scenario')")}
      </div>
      ${table(
        [
          { key: 'scenario',    label: 'Scenario' },
          { key: 'avg_score',   label: 'Avg CQ%',    render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls', label: 'Calls',       render: v => Number(v || 0).toLocaleString() },
          { key: 'fatal_count', label: 'Fatal',       render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
        ],
        rows,
        { emptyMsg: 'No scenario data — Scenario column may not be populated in db_audit' }
      )}`;
  },

  'pm-detail-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/detail-analysis', { preset });
    const rows = r.data?.rows || r.data || [];
    return `
      ${pageHeader('Detail Analysis', 'Agent × Parameter scorecard · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-detail-analysis')")}
      </div>
      ${table(
        [
          { key: 'name',           label: 'Analyst' },
          { key: 'avg_score',      label: 'Avg CQ%',    render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',    label: 'Calls',      render: v => Number(v || 0).toLocaleString() },
          { key: 'fatal_count',    label: 'Fatal',      render: v => v > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'classification', label: 'Class',      render: v => classificationBadge(v) },
          { key: 'opening',        label: 'Opening',    render: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
          { key: 'compliance',     label: 'Compliance', render: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
          { key: 'resolution',     label: 'Resolution', render: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
        ],
        rows,
        { emptyMsg: 'No detail data for period' }
      )}`;
  },

  'pm-escalation': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/escalation-analysis', { preset });
    const d = r.data || {};
    const scamDayWise = d.scam_day_wise || [];
    setTimeout(() => {
      if (scamDayWise.length > 0) {
        barChart('pmScamChart',
          [{ name: 'Scam Mentions', data: scamDayWise.map(d => d.scam_count) }],
          scamDayWise.map(d => d.call_date)
        );
      }
    }, 0);
    return `
      ${pageHeader('Escalation Analysis', 'Inbound negative signals · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-escalation')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Potential Escalations', Number(d.potential_escalations || 0).toLocaleString(), '', 'down')}
        ${kpi('Social Media Threat',   Number(d.social_media_threat  || 0).toLocaleString(), '', 'down')}
        ${kpi('Scam Mentions',         Number(d.scam_mentions        || 0).toLocaleString())}
        ${kpi('Competitor Mentions',   Number(d.competitor_mentions  || 0).toLocaleString())}
      </div>
      <div class="card">
        <div class="chart-title">Scam Mention Day-wise</div>
        <div class="chart-wrap" id="pmScamChart"></div>
      </div>`;
  },

  // ══════════════════════════════════════════════
  // OUTBOUND-ONLY PAGES
  // ══════════════════════════════════════════════

  'pm-cst-crt': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/cst-crt-funnel', { preset });
    const d = r.data || {};
    const cst = d.cst || {};
    const crt = d.crt || {};
    setTimeout(() => {
      funnelChart('pmCstFunnel',
        ['Total Calls','Opening Pitched','Context Pitched','Offer Pitched','Sale Done'],
        [cst.total_calls, cst.ops, cst.cps, cst.offer_success, cst.sale_done],
        { title: 'CST — Success Track', color: '#06d6a0' }
      );
      funnelChart('pmCrtFunnel',
        ['Opening Rejected','Context Rejected','Offer Rejected','Post-Offer Rejected'],
        [crt.or_count, crt.cr_count, crt.opr_count, crt.por_count],
        { title: 'CRT — Rejection Track', color: '#ef4444' }
      );
    }, 0);
    return `
      ${pageHeader('CST / CRT Funnel', 'Outbound pitch success + rejection tracks · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-cst-crt')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Total Calls',   Number(cst.total_calls || 0).toLocaleString())}
        ${kpi('Sale Done',     Number(cst.sale_done   || 0).toLocaleString(), `Success Rate: ${cst.success_rate || 0}%`, 'up')}
        ${kpi('Success Rate',  (cst.success_rate || 0) + '%', 'Sale Done / Total')}
        ${kpi('Failure Rate',  (crt.failure_rate || 0) + '%', 'Any rejection / Total', 'down')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div id="pmCstFunnel"></div>
        </div>
        <div class="card">
          <div id="pmCrtFunnel"></div>
        </div>
      </div>`;
  },

  'pm-missed-opp': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/missed-opportunities', { preset });
    const d = r.data || {};
    const cats = d.categories || [];
    return `
      ${pageHeader('Missed Opportunity Analysis', 'Outbound MOA · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-missed-opp')")}
      </div>
      <div class="kpi-grid">
        ${kpi('Total Opportunities', Number(d.total_opportunities || 0).toLocaleString())}
        ${kpi('Missed Count',        Number(d.mo_count || 0).toLocaleString(), '', 'down')}
        ${kpi('MO Rate%',            d.total_opportunities > 0 ? ((d.mo_count / d.total_opportunities) * 100).toFixed(1) + '%' : '—', '', 'down')}
      </div>
      ${table(
        [
          { key: 'category',    label: 'MO Category' },
          { key: 'count',       label: 'Count',       render: v => Number(v || 0).toLocaleString() },
          { key: 'contr_pct',   label: 'Contr%',      render: v => v != null ? v + '%' : '—' },
          { key: 'observation', label: 'AI Observation', render: v => v || '<span class="text3">—</span>' },
        ],
        cats,
        { emptyMsg: 'No MO data — Feedback_Category column may be empty' }
      )}`;
  },

  'pm-nps-csat': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/nps-csat', { preset });
    const d = r.data || {};
    const dayWise = d.day_wise || [];
    setTimeout(() => {
      gaugeChart('pmNpsGauge',  d.nps_score  || 0, 100, `NPS: ${d.nps_score  || 0}`, { color: (d.nps_score || 0) > 0 ? '#06d6a0' : '#ef4444' });
      gaugeChart('pmCsatGauge', d.csat_score || 0, 100, `${d.csat_score || 0}%`,      { color: '#3b82f6' });
      if (dayWise.categories) {
        lineChart('pmNpsTrendChart', [
          { name: 'NPS',  data: dayWise.nps },
          { name: 'CSAT', data: dayWise.csat },
        ], dayWise.categories);
      } else if (dayWise.length > 0) {
        lineChart('pmNpsTrendChart', [
          { name: 'NPS',  data: dayWise.map(d => d.nps_score || 0) },
          { name: 'CSAT', data: dayWise.map(d => d.csat_score || 0) },
        ], dayWise.map(d => d.call_date));
      }
    }, 0);
    return `
      ${pageHeader('NPS & CSAT Estimation', 'Outbound customer experience · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-nps-csat')")}
      </div>
      <div class="kpi-grid">
        ${kpi('NPS Score',    (d.nps_score  || 0).toString(), 'Net Promoter Score')}
        ${kpi('CSAT',         (d.csat_score || 0) + '%', 'Customer Satisfaction')}
        ${kpi('Promoters',    Number(d.promoters  || 0).toLocaleString())}
        ${kpi('Detractors',   Number(d.detractors || 0).toLocaleString(), '', 'down')}
        ${kpi('Passives',     Number(d.passives   || 0).toLocaleString())}
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card"><div id="pmNpsGauge"></div></div>
        <div class="card"><div id="pmCsatGauge"></div></div>
      </div>
      <div class="card">
        <div class="chart-title">NPS & CSAT Day-wise Trend</div>
        <div class="chart-wrap" id="pmNpsTrendChart"></div>
      </div>`;
  },

  'pm-pitch-stage': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/pitch-stage-analysis', { preset });
    const d = r.data || {};
    const op = d.op_analysis || d.op || [];
    const offered = d.offered_pitch || d.offered || [];
    return `
      ${pageHeader('Pitch Stage Analysis', 'Outbound stage breakdown · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-pitch-stage')")}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Opening Pitch Analysis</div>
        ${table(
          [
            { key: 'op_category',  label: 'OP Category', render: (v, r) => v || r.category },
            { key: 'count',        label: 'Count',       render: v => Number(v || 0).toLocaleString() },
            { key: 'success_rate', label: 'Success%',    render: v => v != null ? v + '%' : '—' },
          ],
          op
        )}
      </div>
      <div class="card">
        <div class="card-title">Offered Pitch Analysis by Discount Type</div>
        ${table(
          [
            { key: 'discount_type', label: 'Discount Type' },
            { key: 'total_offered', label: 'Offered',     render: v => Number(v || 0).toLocaleString() },
            { key: 'or_count',      label: 'OR Count',    render: v => Number(v || 0).toLocaleString() },
            { key: 'or_pct',        label: 'OR%',         render: v => v != null ? v + '%' : '—' },
            { key: 'os_count',      label: 'OS Count',    render: v => Number(v || 0).toLocaleString() },
            { key: 'os_pct',        label: 'OS%',         render: v => v != null ? v + '%' : '—' },
            { key: 'sale_count',    label: 'Sales',       render: v => Number(v || 0).toLocaleString() },
            { key: 'conversion_pct',label: 'Conversion%', render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          ],
          offered,
          { emptyMsg: 'No offer data — Pricing_and_Discount_Structure column may be empty' }
        )}
      </div>`;
  },

  'pm-objection-rebuttal': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/objection-rebuttal', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Objection Rebuttal Analysis', 'Outbound rebuttal effectiveness · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, "go.bind(null,'pm-objection-rebuttal')")}
      </div>
      ${table(
        [
          { key: 'main_objection',        label: 'Objection' },
          { key: 'agent_rebuttal',        label: 'Agent Rebuttal' },
          { key: 'objection_count',       label: 'Count',          render: v => Number(v || 0).toLocaleString() },
          { key: 'failed_rebuttal_pct',   label: 'Failed%',        render: v => `<span class="sev-high">${v}%</span>` },
          { key: 'failed_rebuttal',       label: 'Failed',         render: v => Number(v || 0).toLocaleString() },
          { key: 'successful_rebuttal_pct',label:'Success%',       render: v => `<span class="kpi-trend-up">${v}%</span>` },
          { key: 'successful_rebuttal',   label: 'Successful',     render: v => Number(v || 0).toLocaleString() },
          { key: 'conversion_pct',        label: 'Conversion%',    render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
        ],
        rows,
        { emptyMsg: 'No objection data — ObjectionHandling column may be empty' }
      )}`;
  },
};
```

- [ ] **Step 2: Test in browser**

Log in as `pm`. Test each of the 17 PM pages:
- Shared: Overview gauge renders, Parameters bar chart, Explorer table, Analyst Scorecard with badges, TNI heatmap, Trends dual chart, Defect Analysis
- Inbound: Fatal Analysis with heatmap + KPIs, Scenario Breakdown table, Detail Analysis with classification, Escalation KPIs + chart
- Outbound: CST/CRT dual funnel charts, MOA table, NPS/CSAT dual gauges + trend, Pitch Stage two tables, Objection Rebuttal table

- [ ] **Step 3: Commit**

```bash
git add public/callmaster/js/pages/pm.js
git commit -m "feat(callmaster): implement PM frontend (17 pages — shared, Inbound-only, Outbound-only)"
```

---

## Task 6: Final integration test

- [ ] **Step 1: TypeScript clean build**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Smoke test all PM endpoints**

```bash
npm run dev
```

```bash
TOKEN=$(curl -s -X POST http://localhost:5050/api/callmaster/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026"}' | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>console.log(JSON.parse(Buffer.concat(c)).token))")

for EP in overview parameter-breakdown analyst-scorecard tni-report fatal-analysis scenario-breakdown detail-analysis escalation-analysis cst-crt-funnel missed-opportunities nps-csat pitch-stage-analysis objection-rebuttal; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5050/api/callmaster/pm/$EP \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"preset":"MTD","process_ids":["GNC Inbound"]}')
  echo "$EP → $STATUS"
done
```
Expected: all return `200`.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(callmaster): Plan 3 complete — Process Manager persona fully implemented (17 endpoints, 15 pages)"
```

---

## Plan 3 Complete

**Next: [Plan 4 — Branch Manager, Analyst, Admin](2026-05-27-callmaster-plan4-bm-analyst-admin.md)**
