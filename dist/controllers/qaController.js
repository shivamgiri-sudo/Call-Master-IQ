"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAudits = listAudits;
exports.createAudit = createAudit;
exports.updateAudit = updateAudit;
exports.getAudit = getAudit;
exports.triggerReaudit = triggerReaudit;
const qaAuditService_1 = require("../services/qaAuditService");
const callQueryService_1 = require("../services/callQueryService");
const db_1 = __importDefault(require("../config/db"));
async function listAudits(req, res) {
    try {
        const result = await (0, qaAuditService_1.getManualAudits)({
            auditor_user_id: req.query.auditor_user_id ? parseInt(req.query.auditor_user_id) : undefined,
            client_id: req.query.client_id,
            agent_employee_code: req.query.agent_code,
            audit_status: req.query.status,
            from: req.query.from,
            to: req.query.to,
            page: parseInt(req.query.page) || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 100),
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function createAudit(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { source_call_id, source_type, client_id, process_name, business_lob, campaign_name, call_date, agent_employee_code, scores, manual_remarks, audit_status } = req.body;
        if (!source_call_id || !source_type || !client_id || !scores) {
            res.status(400).json({ success: false, message: 'source_call_id, source_type, client_id, scores are required' });
            return;
        }
        const result = await (0, qaAuditService_1.createManualAudit)({
            source_call_id, source_type, auditor_user_id: req.user.user_id,
            client_id, process_name, business_lob, campaign_name, call_date,
            agent_employee_code, scores, manual_remarks, audit_status,
        });
        res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function updateAudit(req, res) {
    try {
        const audit_id = parseInt(req.params.id);
        const existing = await (0, qaAuditService_1.getManualAuditById)(audit_id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Audit not found' });
            return;
        }
        await (0, qaAuditService_1.updateManualAudit)(audit_id, {
            scores: req.body.scores,
            manual_remarks: req.body.manual_remarks,
            audit_status: req.body.audit_status,
        });
        res.json({ success: true, message: 'Audit updated' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getAudit(req, res) {
    try {
        const audit = await (0, qaAuditService_1.getManualAuditById)(parseInt(req.params.id));
        if (!audit) {
            res.status(404).json({ success: false, message: 'Audit not found' });
            return;
        }
        res.json({ success: true, data: audit });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function triggerReaudit(req, res) {
    try {
        const call = await (0, callQueryService_1.getCallDetail)(req.params.id, req.scopeFilter || {});
        if (!call) {
            res.status(404).json({ success: false, message: 'Call not found' });
            return;
        }
        if (!call.transcript_text) {
            res.status(400).json({ success: false, message: 'No transcript available for this call' });
            return;
        }
        // Fetch prompt config for this call's LOB
        const [prompts] = await db_1.default.execute(`SELECT system_prompt FROM audit_prompt_config
       WHERE client_id = ? AND is_active = 1
         AND (process_name = ? OR process_name IS NULL)
         AND (business_lob = ? OR business_lob IS NULL)
         AND source_type = ?
       ORDER BY process_name DESC, business_lob DESC
       LIMIT 1`, [call.client_id, call.process_name, call.business_lob, call.source_type]);
        const systemPrompt = prompts[0]?.system_prompt || getDefaultQAPrompt();
        const result = await (0, qaAuditService_1.runAIReaudit)(call.transcript_text, {
            system_prompt: systemPrompt,
            process_name: call.process_name,
            business_lob: call.business_lob,
        });
        res.json({ success: true, data: { source_call_id: call.source_call_id, ai_scores: result } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
function getDefaultQAPrompt() {
    return `You are a call centre quality auditor. Evaluate each transcript against the 20 standard quality parameters. Score 1 for pass, 0 for fail, null if not applicable. Always respond with valid JSON only.`;
}
