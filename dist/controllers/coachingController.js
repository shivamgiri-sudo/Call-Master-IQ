"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCoaching = listCoaching;
exports.generateCoaching = generateCoaching;
exports.getCoaching = getCoaching;
exports.assign = assign;
exports.myAssignments = myAssignments;
exports.updateStatus = updateStatus;
const coachingAIService_1 = require("../services/coachingAIService");
const callQueryService_1 = require("../services/callQueryService");
async function listCoaching(req, res) {
    try {
        const result = await (0, coachingAIService_1.getCoachingList)({
            client_id: req.query.client_id,
            business_lob: req.query.business_lob,
            defect_parameter: req.query.defect_parameter,
            page: parseInt(req.query.page) || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 100),
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function generateCoaching(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { defect_parameter, process_name, business_lob, source_type, client_id, transcript_excerpts } = req.body;
        if (!defect_parameter || !client_id) {
            res.status(400).json({ success: false, message: 'defect_parameter and client_id are required' });
            return;
        }
        // If no excerpts provided, auto-fetch failing transcripts from the DB
        let excerpts = transcript_excerpts || [];
        if (excerpts.length === 0) {
            const calls = await (0, callQueryService_1.getCallList)({
                scope: req.scopeFilter || {},
                client_id,
                process_name,
                business_lob,
                source_type,
                limit: 5,
            });
            excerpts = calls.data
                .filter((c) => c.transcript_text)
                .map((c) => c.transcript_text)
                .slice(0, 5);
        }
        if (excerpts.length === 0) {
            res.status(400).json({ success: false, message: 'No transcript excerpts available — provide transcript_excerpts in body' });
            return;
        }
        const result = await (0, coachingAIService_1.generateCoachingContent)({
            defect_parameter, process_name, business_lob, source_type, client_id,
            transcript_excerpts: excerpts,
            created_by_user_id: req.user.user_id,
        });
        res.status(201).json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function getCoaching(req, res) {
    try {
        const item = await (0, coachingAIService_1.getCoachingById)(parseInt(req.params.id));
        if (!item) {
            res.status(404).json({ success: false, message: 'Coaching not found' });
            return;
        }
        res.json({ success: true, data: item });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function assign(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { employee_codes } = req.body;
        if (!Array.isArray(employee_codes) || employee_codes.length === 0) {
            res.status(400).json({ success: false, message: 'employee_codes array is required' });
            return;
        }
        await (0, coachingAIService_1.assignCoaching)(parseInt(req.params.id), employee_codes, req.user.user_id);
        res.json({ success: true, message: `Assigned to ${employee_codes.length} agent(s)` });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function myAssignments(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const empCode = req.user.employee_code;
        if (!empCode) {
            res.json({ success: true, data: [], total: 0 });
            return;
        }
        const result = await (0, coachingAIService_1.getMyAssignments)(empCode, parseInt(req.query.page) || 1, Math.min(parseInt(req.query.limit) || 20, 100));
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function updateStatus(req, res) {
    try {
        const { status } = req.body;
        if (!['viewed', 'completed'].includes(status)) {
            res.status(400).json({ success: false, message: "status must be 'viewed' or 'completed'" });
            return;
        }
        await (0, coachingAIService_1.updateAssignmentStatus)(parseInt(req.params.id), status);
        res.json({ success: true, message: 'Status updated' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
