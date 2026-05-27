"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.getPool = getPool;
exports.pingDb = pingDb;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const promise_1 = __importDefault(require("mysql2/promise"));
let _pool = null;
function getPool() {
    if (!_pool) {
        _pool = promise_1.default.createPool({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME, // Shivamgiri
            waitForConnections: true,
            connectionLimit: 10,
            timezone: '+05:30',
        });
    }
    return _pool;
}
exports.db = new Proxy({}, {
    get(_t, prop) {
        return getPool()[prop];
    },
});
exports.default = exports.db;
async function pingDb() {
    const [rows] = await exports.db.query('SELECT DATABASE() current_database, USER() login_user, NOW() server_time');
    return rows[0];
}
