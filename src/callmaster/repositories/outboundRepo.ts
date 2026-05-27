// src/callmaster/repositories/outboundRepo.ts
import dbExternalPool from '../../config/dbExternal';
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, paginationClause, Preset } from './baseRepository';

async function qExternal<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (dbExternalPool as any).execute(sql, params);
  return rows;
}

async function qShivamgiri<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows;
}

// Resolve client_ids for given process names via process_mapping_master (Shivamgiri)
async function clientIdsForProcesses(processIds: string[]): Promise<string[]> {
  if (processIds.includes('*') || processIds.length === 0) return ['*'];
  const { clause: pClause, params: pParams } = safeScopeFilter('process_name', processIds);
  const rows = await qShivamgiri<any>(
    `SELECT dialdesk_client_id FROM process_mapping_master WHERE source_type='Outbound' AND ${pClause} AND active_status=1`,
    pParams
  );
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

  const rows = await qExternal(`
    SELECT
      COUNT(*) AS total_calls,
      SUM(CASE WHEN Opening IS NOT NULL AND Opening != '' THEN 1 ELSE 0 END) AS ops,
      SUM(CASE WHEN Offered IS NOT NULL AND Offered != '' THEN 1 ELSE 0 END) AS cps,
      SUM(CASE WHEN Snapmint_Pitch = 'Sale Done' OR LOWER(SaleDone) IN ('yes','1','true') THEN 1 ELSE 0 END) AS sale_done,
      SUM(CASE WHEN OpeningRejected IS NOT NULL AND OpeningRejected != '' AND LOWER(OpeningRejected) NOT IN ('no','n/a','na') THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN OfferingRejected IS NOT NULL AND OfferingRejected != '' AND LOWER(OfferingRejected) NOT IN ('no','n/a','na') THEN 1 ELSE 0 END) AS cr_count,
      SUM(CASE WHEN AfterListeningOfferRejected IS NOT NULL AND AfterListeningOfferRejected != '' AND LOWER(AfterListeningOfferRejected) NOT IN ('no','n/a','na') THEN 1 ELSE 0 END) AS opr_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND ${cClause}
  `, [startDate, endDate, ...cParams]);

  const row = rows[0] as any;
  const total    = Number(row?.total_calls ?? 0);
  const saleDone = Number(row?.sale_done ?? 0);
  const offered  = Number(row?.cps ?? 0);
  const totalRej = Number(row?.or_count ?? 0) + Number(row?.cr_count ?? 0) + Number(row?.opr_count ?? 0);

  return {
    cst: {
      total_calls:   total,
      ops:           Number(row?.ops ?? 0),
      cps:           offered,
      offer_success: offered,
      sale_done:     saleDone,
      success_rate:  total > 0 ? +((saleDone / total) * 100).toFixed(2) : 0,
    },
    crt: {
      or_count:     Number(row?.or_count ?? 0),
      cr_count:     Number(row?.cr_count ?? 0),
      opr_count:    Number(row?.opr_count ?? 0),
      por_count:    0,
      failure_rate: total > 0 ? +((totalRej / total) * 100).toFixed(2) : 0,
    },
  };
}

export async function getMissedOpportunities(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const summaryRows = await qExternal(`
    SELECT COUNT(*) AS total_opportunities,
           SUM(CASE WHEN Feedback_Category IS NOT NULL AND TRIM(Feedback_Category) != '' THEN 1 ELSE 0 END) AS mo_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ? AND ${cClause}
  `, [startDate, endDate, ...cParams]);
  const summary = (summaryRows[0] as any) || {};

  const categories = await qExternal(`
    SELECT
      Feedback_Category AS category,
      COUNT(*) AS count,
      ROUND(COUNT(*) / ? * 100, 1) AS contr_pct
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND Feedback_Category IS NOT NULL AND TRIM(Feedback_Category) != ''
      AND ${cClause}
    GROUP BY Feedback_Category
    ORDER BY count DESC
    LIMIT 10
  `, [Number(summary.mo_count) || 1, startDate, endDate, ...cParams]);

  return {
    total_opportunities: Number(summary.total_opportunities ?? 0),
    mo_count:            Number(summary.mo_count ?? 0),
    categories:          categories.map((r: any) => ({ ...r, observation: null })),
  };
}

export async function getNpsCsat(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  // NPS derived from call_ai_insight (Shivamgiri), joined via outbound KPI view
  const { clause: pClause, params: pParams } = safeScopeFilter('k.process_name', opts.processIds);

  const dayWise = await qShivamgiri(`
    SELECT
      DATE(k.call_datetime) AS call_date,
      COUNT(*) AS record_count,
      SUM(CASE WHEN i.nps_risk = 'Detractor' THEN 1 ELSE 0 END) AS detractor_count,
      SUM(CASE WHEN i.nps_risk = 'Passive'   THEN 1 ELSE 0 END) AS passive_count,
      SUM(CASE WHEN i.nps_risk = 'Promoter'  THEN 1 ELSE 0 END) AS promoter_count
    FROM v_call_master_outbound_kpi k
    INNER JOIN call_ai_insight i
      ON i.source_type = 'Outbound'
      AND i.source_call_id = CAST(k.source_call_id AS CHAR)
    WHERE k.call_date BETWEEN ? AND ? AND ${pClause}
    GROUP BY DATE(k.call_datetime)
    ORDER BY call_date
  `, [startDate, endDate, ...pParams]);

  const totals = dayWise.reduce((acc: any, r: any) => {
    acc.detractors += Number(r.detractor_count);
    acc.passives   += Number(r.passive_count);
    acc.promoters  += Number(r.promoter_count);
    acc.total      += Number(r.record_count);
    return acc;
  }, { detractors: 0, passives: 0, promoters: 0, total: 0 });

  const npsScore  = totals.total > 0 ? +((totals.promoters - totals.detractors) / totals.total * 100).toFixed(2) : 0;
  const csatScore = totals.total > 0 ? +((totals.promoters + totals.passives)   / totals.total * 100).toFixed(1) : 0;

  return {
    nps_score:  npsScore,
    csat_score: csatScore,
    detractors: totals.detractors,
    passives:   totals.passives,
    promoters:  totals.promoters,
    day_wise:   dayWise,
  };
}

export async function getPitchStageAnalysis(opts: { processIds: string[]; preset: Preset }) {
  const { startDate, endDate } = presetToDateRange(opts.preset);
  const clientIds = await clientIdsForProcesses(opts.processIds);
  const { clause: cClause, params: cParams } = safeScopeFilter('client_id', clientIds);

  const opAnalysis = await qExternal(`
    SELECT
      OpeningPitchCategory AS op_category,
      COUNT(*) AS count,
      ROUND(SUM(CASE WHEN Snapmint_Pitch='Sale Done' OR LOWER(SaleDone) IN ('yes','1','true') THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) AS success_rate
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND OpeningPitchCategory IS NOT NULL AND TRIM(OpeningPitchCategory) != ''
      AND ${cClause}
    GROUP BY OpeningPitchCategory
    ORDER BY count DESC
  `, [startDate, endDate, ...cParams]);

  const offeredPitch = await qExternal(`
    SELECT
      Pricing_and_Discount_Structure AS discount_type,
      COUNT(*) AS total_offered,
      SUM(CASE WHEN OfferingRejected IS NOT NULL AND TRIM(OfferingRejected) != '' AND LOWER(OfferingRejected) NOT IN ('no','n/a','na') THEN 1 ELSE 0 END) AS or_count,
      SUM(CASE WHEN Offered IS NOT NULL AND TRIM(Offered) != '' THEN 1 ELSE 0 END) AS os_count,
      SUM(CASE WHEN Snapmint_Pitch='Sale Done' OR LOWER(SaleDone) IN ('yes','1','true') THEN 1 ELSE 0 END) AS sale_count
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND Pricing_and_Discount_Structure IS NOT NULL AND TRIM(Pricing_and_Discount_Structure) != ''
      AND ${cClause}
    GROUP BY Pricing_and_Discount_Structure
    ORDER BY total_offered DESC
    LIMIT 20
  `, [startDate, endDate, ...cParams]);

  return {
    op_analysis:    opAnalysis,
    offered_pitch:  offeredPitch.map((r: any) => ({
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
      CustomerObjectionCategory AS main_objection,
      AgentRebuttalCategory AS agent_rebuttal,
      COUNT(*) AS objection_count,
      SUM(CASE WHEN Snapmint_Pitch='Sale Done' OR LOWER(SaleDone) IN ('yes','1','true') THEN 1 ELSE 0 END) AS successful_rebuttal,
      SUM(CASE WHEN Snapmint_Pitch!='Sale Done' AND LOWER(COALESCE(SaleDone,'')) NOT IN ('yes','1','true') THEN 1 ELSE 0 END) AS failed_rebuttal
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ?
      AND CustomerObjectionCategory IS NOT NULL AND TRIM(CustomerObjectionCategory) != ''
      AND ${cClause}
    GROUP BY CustomerObjectionCategory, AgentRebuttalCategory
    ORDER BY objection_count DESC
    LIMIT 30
  `, [startDate, endDate, ...cParams]);

  return rows.map((r: any) => ({
    ...r,
    failed_rebuttal_pct:      r.objection_count > 0 ? +((r.failed_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
    successful_rebuttal_pct:  r.objection_count > 0 ? +((r.successful_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
    conversion_pct:           r.objection_count > 0 ? +((r.successful_rebuttal / r.objection_count) * 100).toFixed(1) : 0,
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
           CustomerObjectionCategory AS objection, OpeningPitchCategory AS opening_category
    FROM CallDetails
    WHERE DATE(CallDate) BETWEEN ? AND ? AND ${cClause}
    ORDER BY CallDate DESC
    ${paginationClause({ page: opts.page, limit: opts.limit })}
  `, [startDate, endDate, ...cParams]);

  return { total: null, calls: rows };
}
