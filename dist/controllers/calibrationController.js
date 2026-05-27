"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.listSessions = listSessions;
exports.addCallsToSession = addCallsToSession;
exports.getSessionReport = getSessionReport;
exports.closeSession = closeSession;
const db_1 = __importDefault(require("../config/db"));
const callQueryService_1 = require("../services/callQueryService");
async function createSession(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { session_name, client_id, process_name, source_type } = req.body;
        if (!session_name || !client_id || !source_type) {
            res.status(400).json({ success: false, message: 'session_name, client_id, source_type are required' });
            return;
        }
        const [result] = await db_1.default.execute(`INSERT INTO calibration_session (session_name, client_id, process_name, source_type, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, [session_name, client_id, process_name || null, source_type, req.user.user_id]);
        res.status(201).json({ success: true, data: { session_id: result.insertId } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function listSessions(req, res) {
    try {
        const [rows] = await db_1.default.execute(`SELECT cs.*, um.full_name AS created_by_name
       FROM calibration_session cs
       LEFT JOIN user_master um ON um.user_id = cs.created_by_user_id
       ORDER BY cs.created_at DESC`);
        res.json({ success: true, data: rows });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function addCallsToSession(req, res) {
    try {
        const session_id = parseInt(req.params.id);
        const { call_ids } = req.body;
        if (!Array.isArray(call_ids) || call_ids.length === 0) {
            res.status(400).json({ success: false, message: 'call_ids array is required' });
            return;
        }
        for (const call_id of call_ids) {
            const call = await (0, callQueryService_1.getCallDetail)(call_id, req.scopeFilter || {});
            if (!call)
                continue;
            // Check if manual audit exists
            const [audits] = await db_1.default.execute('SELECT audit_id, manual_quality_percentage FROM manual_qa_audit WHERE source_call_id = ? LIMIT 1', [call_id]);
            const manualAudit = audits[0] || null;
            let variance = null;
            if (manualAudit && call.quality_score !== null) {
                variance = parseFloat((parseFloat(manualAudit.manual_quality_percentage) - parseFloat(call.quality_score)).toFixed(2));
            }
            await db_1.default.execute(`INSERT IGNORE INTO calibration_call
           (session_id, source_call_id, manual_audit_id, ai_quality_percentage,
            manual_quality_percentage, variance)
         VALUES (?, ?, ?, ?, ?, ?)`, [session_id, call_id, manualAudit?.audit_id || null,
                call.quality_score || null,
                manualAudit?.manual_quality_percentage || null,
                variance]);
        }
        res.json({ success: true, message: `${call_ids.length} call(s) added to session` });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getSessionReport(req, res) {
    try {
        const session_id = parseInt(req.params.id);
        const [session] = await db_1.default.execute('SELECT * FROM calibration_session WHERE session_id = ?', [session_id]);
        if (!session[0]) {
            res.status(404).json({ success: false, message: 'Session not found' });
            return;
        }
        const [calls] = await db_1.default.execute(`SELECT cc.*, mqa.manual_remarks,
              mqa.customer_concern_acknowledged AS m_concern,
              mqa.professionalism_maintained AS m_professionalism,
              mqa.proper_hold_procedure AS m_hold,
              mqa.correct_and_complete_information AS m_correct_info,
              mqa.proper_call_closure AS m_closure
       FROM calibration_call cc
       LEFT JOIN manual_qa_audit mqa ON mqa.audit_id = cc.manual_audit_id
       WHERE cc.session_id = ?
       ORDER BY ABS(COALESCE(cc.variance, 0)) DESC`, [session_id]);
        const totalCalls = calls.length;
        const withBoth = calls.filter((c) => c.ai_quality_percentage !== null && c.manual_quality_percentage !== null);
        const avgVariance = withBoth.length > 0
            ? parseFloat((withBoth.reduce((s, c) => s + Math.abs(c.variance || 0), 0) / withBoth.length).toFixed(2))
            : null;
        res.json({
            success: true,
            data: {
                session: session[0],
                calls,
                summary: { total_calls: totalCalls, calibrated: withBoth.length, avg_variance: avgVariance },
            }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function closeSession(req, res) {
    try {
        const session_id = parseInt(req.params.id);
        const { prompt_improvement_notes, discrepancy_summary } = req.body;
        await db_1.default.execute(`UPDATE calibration_session
       SET session_status = 'closed', prompt_improvement_notes = ?, discrepancy_summary = ?
       WHERE session_id = ?`, [prompt_improvement_notes || null, discrepancy_summary || null, session_id]);
        res.json({ success: true, message: 'Session closed' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
