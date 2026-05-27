"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.me = me;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
async function register(req, res) {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ success: false, message: 'name, email and password are required' });
        return;
    }
    const [existing] = await db_1.db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
        res.status(409).json({ success: false, message: 'Email already registered' });
        return;
    }
    const hash = await bcryptjs_1.default.hash(password, 10);
    const [result] = await db_1.db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
    const token = jsonwebtoken_1.default.sign({ userId: result.insertId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user: { id: result.insertId, name, email, plan: 'free' } });
}
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ success: false, message: 'email and password are required' });
        return;
    }
    const [rows] = await db_1.db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
}
async function me(req, res) {
    const [rows] = await db_1.db.query('SELECT id, name, email, plan, docs_generated, created_at FROM users WHERE id = ?', [req.userId]);
    const user = rows[0];
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    res.json({ success: true, user });
}
