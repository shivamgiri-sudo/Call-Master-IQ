"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditPool = getAuditPool;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool = null;
function getAuditPool() {
    if (!pool) {
        pool = promise_1.default.createPool({
            host: process.env.DB_HOST || '192.168.10.6',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_AUDIT_NAME || 'db_audit',
            waitForConnections: true,
            connectionLimit: 5,
        });
    }
    return pool;
}
const dbAuditPool = new Proxy({}, {
    get(_target, prop) {
        return getAuditPool()[prop];
    },
});
exports.default = dbAuditPool;
