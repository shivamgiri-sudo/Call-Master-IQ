"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.jwtAuth = jwtAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
}
async function jwtAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const [rows] = await db_1.default.execute(`SELECT user_id, login_id, role_code, branch_short_name, employee_code
       FROM user_master WHERE user_id = ? AND active_status = 1 LIMIT 1`, [payload.userId]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'User not found' });
            return;
        }
        req.user = rows[0];
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
}
