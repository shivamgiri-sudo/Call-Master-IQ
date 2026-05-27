"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = dashboard;
exports.agentPerformance = agentPerformance;
exports.branchPerformance = branchPerformance;
exports.processPerformance = processPerformance;
exports.qualityTrends = qualityTrends;
exports.parameterRates = parameterRates;
exports.dailyReport = dailyReport;
const analyticsService_1 = require("../services/analyticsService");
const dashboard_service_1 = require("../services/dashboard.service");
function buildFilter(req) {
    return {
        scope: req.scopeFilter || {},
        client_id: req.query.client_id,
        from: req.query.from,
        to: req.query.to,
        source_type: req.query.source_type,
        process_name: req.query.process_name,
        business_lob: req.query.business_lob,
        branch_short_name: req.query.branch_short_name,
    };
}
/**
 * GET /api/analytics/dashboard
 * Returns summary + branch_process_performance + trend from the KPI view.
 */
async function dashboard(req, res) {
    try {
        const startDate = typeof req.query.startDate === 'string'
            ? req.query.startDate
            : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const endDate = typeof req.query.endDate === 'string'
            ? req.query.endDate
            : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const data = await (0, dashboard_service_1.getDashboardSummary)(req.user, startDate, endDate);
        res.json({
            success: true,
            data: {
                role: req.user?.role_code || 'CEO',
                date_range: { startDate, endDate },
                ...data,
                ai_insight: (0, dashboard_service_1.buildRoleInsight)(req.user?.role_code),
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function agentPerformance(req, res) {
    try {
        const data = await (0, analyticsService_1.getAgentPerformance)(buildFilter(req));
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function branchPerformance(req, res) {
    try {
        const data = await (0, analyticsService_1.getBranchPerformance)(buildFilter(req));
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function processPerformance(req, res) {
    try {
        const data = await (0, analyticsService_1.getProcessPerformance)(buildFilter(req));
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function qualityTrends(req, res) {
    try {
        const granularity = req.query.granularity || 'daily';
        const data = await (0, analyticsService_1.getQualityTrends)(buildFilter(req), granularity);
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function parameterRates(req, res) {
    try {
        const data = await (0, analyticsService_1.getParameterFailureRates)(buildFilter(req));
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function dailyReport(req, res) {
    try {
        const data = await (0, analyticsService_1.getDailyReport)(buildFilter(req));
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
