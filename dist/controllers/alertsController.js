"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAlerts = listAlerts;
exports.ackAlert = ackAlert;
exports.listCriticalCalls = listCriticalCalls;
const alertService_1 = require("../services/alertService");
async function listAlerts(req, res) {
    try {
        const result = await (0, alertService_1.getAlerts)(req.scopeFilter || {}, {
            severity: req.query.severity,
            alert_type: req.query.alert_type,
            is_acknowledged: req.query.is_acknowledged,
            from: req.query.from,
            to: req.query.to,
            page: parseInt(req.query.page) || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 200),
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function ackAlert(req, res) {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        await (0, alertService_1.acknowledgeAlert)(parseInt(req.params.id), req.user.user_id);
        res.json({ success: true, message: 'Alert acknowledged' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
async function listCriticalCalls(req, res) {
    try {
        const result = await (0, alertService_1.getCriticalCalls)(req.scopeFilter || {}, {
            from: req.query.from,
            to: req.query.to,
            client_id: req.query.client_id,
            page: parseInt(req.query.page) || 1,
            limit: Math.min(parseInt(req.query.limit) || 50, 200),
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}
