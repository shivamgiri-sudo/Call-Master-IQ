import { Request, Response } from 'express';
import {
  getCallList,
  getCallDetail as legacyGetCallDetail,
  getDistinctFilterValues,
} from '../services/callQueryService';
import {
  listCalls as svcListCalls,
  getCallDetail,
  getCachedInsight,
  buildHeuristicInsight,
  saveInsight,
} from '../services/call.service';

// ─── Legacy handlers (kept for backward-compat) ─────────────────────────────

export async function listCallsLegacy(req: Request, res: Response): Promise<void> {
  try {
    const result = await getCallList({
      scope: req.scopeFilter || {},
      from: req.query.from as string,
      to: req.query.to as string,
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      business_lob: req.query.business_lob as string,
      branch_short_name: req.query.branch_short_name as string,
      source_type: req.query.source_type as string,
      campaign_name: req.query.campaign_name as string,
      agent_code: req.query.agent_code as string,
      quality_band: req.query.quality_band as string,
      is_critical: req.query.is_critical as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCall(req: Request, res: Response): Promise<void> {
  try {
    const call = await legacyGetCallDetail(req.params.id as string, req.scopeFilter || {});
    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' });
      return;
    }
    res.json({ success: true, data: call });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCallTranscript(req: Request, res: Response): Promise<void> {
  try {
    const call = await legacyGetCallDetail(req.params.id as string, req.scopeFilter || {});
    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' });
      return;
    }
    res.json({
      success: true,
      data: { source_call_id: call.source_call_id, transcript_text: call.transcript_text },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFilterOptions(req: Request, res: Response): Promise<void> {
  try {
    const options = await getDistinctFilterValues(req.scopeFilter || {});
    res.json({ success: true, data: options });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Phase-2 handlers ────────────────────────────────────────────────────────

/**
 * GET /api/calls
 * List calls from v_call_master_unified_kpi with scope + filters.
 */
export async function listCalls(req: Request, res: Response): Promise<void> {
  try {
    const rows = await svcListCalls(req.user, {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      branch: req.query.branch as string,
      process: req.query.process as string,
      sourceType: req.query.sourceType as string,
    });
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/calls/:sourceType/:callId
 * Full call detail from source DB (db_audit or db_external).
 */
export async function callDetail(req: Request, res: Response): Promise<void> {
  try {
    const sourceType = req.params.sourceType as string;
    const callId = req.params.callId as string;
    const detail = await getCallDetail(sourceType, callId);
    if (!detail) {
      res.status(404).json({ success: false, message: 'Call not found' });
      return;
    }
    const cached = await getCachedInsight(sourceType, callId);
    res.json({
      success: true,
      data: {
        detail,
        insight: cached ? JSON.parse(cached.insight_json) : buildHeuristicInsight(detail),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/calls/:sourceType/:callId/insight
 * Returns cached insight or generates a heuristic one on the fly.
 */
export async function getInsight(req: Request, res: Response): Promise<void> {
  try {
    const sourceType = req.params.sourceType as string;
    const callId = req.params.callId as string;
    const cached = await getCachedInsight(sourceType, callId);
    if (cached) {
      res.json({ success: true, data: JSON.parse(cached.insight_json) });
      return;
    }
    const detail = await getCallDetail(sourceType, callId);
    if (!detail) {
      res.status(404).json({ success: false, message: 'Call not found' });
      return;
    }
    res.json({ success: true, data: buildHeuristicInsight(detail) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/calls/:sourceType/:callId/generate-insight
 * Force-regenerate and persist a heuristic insight.
 */
export async function generateInsight(req: Request, res: Response): Promise<void> {
  try {
    const sourceType = req.params.sourceType as string;
    const callId = req.params.callId as string;
    const detail = await getCallDetail(sourceType, callId);
    if (!detail) {
      res.status(404).json({ success: false, message: 'Call not found' });
      return;
    }
    const insight = await saveInsight(sourceType, callId, buildHeuristicInsight(detail));
    res.json({ success: true, data: insight });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
