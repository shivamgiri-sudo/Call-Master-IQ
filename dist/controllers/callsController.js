"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCallsLegacy = listCallsLegacy;
exports.getCall = getCall;
exports.getCallTranscript = getCallTranscript;
exports.getFilterOptions = getFilterOptions;
exports.listCalls = listCalls;
exports.callDetail = callDetail;
exports.getInsight = getInsight;
exports.generateInsight = generateInsight;
const callQueryService_1 = require("../services/callQueryService");
const call_service_1 = require("../services/call.service");
// ─── Legacy handlers (kept for backward-compat) ─────────────────────────────
async function listCallsLegacy(req, res) {
    try {
        const result = await (0, callQueryService_1.getCallList)({
            scope: req.scopeFilter || {},
            from: req.query.from,
            to: req.query.to,
            client_id: req.query.client_id,
            process_name: req.query.process_name,
            business_lob: req.query.business_lob,
            branch_short_name: req.query.branch_short_name,
            source_type: req.query.source_type,
            campaign_name: req.query.campaign_name,
            agent_code: req.query.agent_code,
            quality_band: req.query.quality_band,
            is_critical: req.query.is_critical,
            search: req.query.search,
            page: parseInt(req.query.page) || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 200),
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getCall(req, res) {
    try {
        const call = await (0, callQueryService_1.getCallDetail)(req.params.id, req.scopeFilter || {});
        if (!call) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        res.json({ success: true, data: call });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getCallTranscript(req, res) {
    try {
        const call = await (0, callQueryService_1.getCallDetail)(req.params.id, req.scopeFilter || {});
        if (!call) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        res.json({
            success: true,
            data: { source_call_id: call.source_call_id, transcript_text: call.transcript_text },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getFilterOptions(req, res) {
    try {
        const options = await (0, callQueryService_1.getDistinctFilterValues)(req.scopeFilter || {});
        res.json({ success: true, data: options });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
// ─── Phase-2 handlers ────────────────────────────────────────────────────────
/**
 * GET /api/calls
 * List calls from v_call_master_unified_kpi with scope + filters.
 */
async function listCalls(req, res) {
    try {
        const rows = await (0, call_service_1.listCalls)(req.user, {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            branch: req.query.branch,
            process: req.query.process,
            sourceType: req.query.sourceType,
        });
        res.json({ success: true, data: rows });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
/**
 * GET /api/calls/:sourceType/:callId
 * Full call detail from source DB (db_audit or db_external).
 */
async function callDetail(req, res) {
    try {
        const sourceType = req.params.sourceType;
        const callId = req.params.callId;
        const detail = await (0, call_service_1.getCallDetail)(sourceType, callId);
        if (!detail) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        const cached = await (0, call_service_1.getCachedInsight)(sourceType, callId);
        res.json({
            success: true,
            data: {
                detail,
                insight: cached ? JSON.parse(cached.insight_json) : (0, call_service_1.buildHeuristicInsight)(detail),
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
/**
 * GET /api/calls/:sourceType/:callId/insight
 * Returns cached insight or generates a heuristic one on the fly.
 */
async function getInsight(req, res) {
    try {
        const sourceType = req.params.sourceType;
        const callId = req.params.callId;
        const cached = await (0, call_service_1.getCachedInsight)(sourceType, callId);
        if (cached) {
            res.json({ success: true, data: JSON.parse(cached.insight_json) });
            return;
        }
        const detail = await (0, call_service_1.getCallDetail)(sourceType, callId);
        if (!detail) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        res.json({ success: true, data: (0, call_service_1.buildHeuristicInsight)(detail) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
/**
 * POST /api/calls/:sourceType/:callId/generate-insight
 * Force-regenerate and persist a heuristic insight.
 */
async function generateInsight(req, res) {
    try {
        const sourceType = req.params.sourceType;
        const callId = req.params.callId;
        const detail = await (0, call_service_1.getCallDetail)(sourceType, callId);
        if (!detail) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        const insight = await (0, call_service_1.saveInsight)(sourceType, callId, (0, call_service_1.buildHeuristicInsight)(detail));
        res.json({ success: true, data: insight });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
