"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qaLogin = qaLogin;
exports.changePassword = changePassword;
exports.resetUserPassword = resetUserPassword;
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUserScope = updateUserScope;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
async function qaLogin(req, res) {
    const { login_id, password } = req.body;
    if (!login_id || !password) {
        res.status(400).json({ success: false, message: 'login_id and password are required' });
        return;
    }
    const [rows] = await db_1.default.execute(`SELECT u.*, r.role_name
     FROM user_master u
     LEFT JOIN role_master r ON r.role_code = u.role_code
     WHERE u.login_id = ? AND u.active_status = 1
     LIMIT 1`, [login_id]);
    const user = rows[0];
    if (!user) {
        await logLoginAttempt(null, login_id, 'FAILED', 'User not found', req);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
    }
    if (user.account_locked) {
        await logLoginAttempt(user.user_id, login_id, 'LOCKED', 'Account locked', req);
        res.status(403).json({ success: false, message: 'Account is locked. Contact your administrator.' });
        return;
    }
    const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!passwordMatch) {
        const newFailCount = (user.failed_login_attempts || 0) + 1;
        const shouldLock = newFailCount >= 5;
        await db_1.default.execute(`UPDATE user_master SET failed_login_attempts = ?, account_locked = ? WHERE user_id = ?`, [newFailCount, shouldLock ? 1 : 0, user.user_id]);
        await logLoginAttempt(user.user_id, login_id, 'FAILED', `Wrong password (attempt ${newFailCount})`, req);
        res.status(401).json({
            success: false,
            message: shouldLock
                ? 'Account locked after 5 failed attempts. Contact administrator.'
                : 'Invalid credentials',
        });
        return;
    }
    // Reset failed attempts on success
    await db_1.default.execute(`UPDATE user_master SET failed_login_attempts = 0, last_login_at = NOW() WHERE user_id = ?`, [user.user_id]);
    await logLoginAttempt(user.user_id, login_id, 'SUCCESS', null, req);
    const token = jsonwebtoken_1.default.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({
        success: true,
        token,
        user: {
            user_id: user.user_id,
            login_id: user.login_id,
            full_name: user.full_name,
            email: user.email,
            role_code: user.role_code,
            role_name: user.role_name,
            branch_short_name: user.branch_short_name,
            employee_code: user.employee_code,
            force_password_change: !!user.force_password_change,
        },
    });
}
async function changePassword(req, res) {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        res.status(400).json({ success: false, message: 'current_password and new_password are required' });
        return;
    }
    if (new_password.length < 8) {
        res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        return;
    }
    const [rows] = await db_1.default.execute('SELECT password_hash FROM user_master WHERE user_id = ?', [req.user.user_id]);
    if (!rows[0]) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    const match = await bcryptjs_1.default.compare(current_password, rows[0].password_hash);
    if (!match) {
        res.status(400).json({ success: false, message: 'Current password is incorrect' });
        return;
    }
    const newHash = await bcryptjs_1.default.hash(new_password, 10);
    await db_1.default.execute(`UPDATE user_master SET password_hash = ?, force_password_change = 0 WHERE user_id = ?`, [newHash, req.user.user_id]);
    res.json({ success: true, message: 'Password changed successfully' });
}
async function resetUserPassword(req, res) {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const targetUserId = parseInt(req.params.userId);
    const tempPassword = req.body.temp_password || generateTempPassword();
    const newHash = await bcryptjs_1.default.hash(tempPassword, 10);
    const [result] = await db_1.default.execute(`UPDATE user_master
     SET password_hash = ?, force_password_change = 1, account_locked = 0, failed_login_attempts = 0
     WHERE user_id = ?`, [newHash, targetUserId]);
    if (result.affectedRows === 0) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    // Log the admin action
    await db_1.default.execute(`INSERT INTO admin_action_log (admin_user_id, action_type, target_table, target_id, remarks)
     VALUES (?, 'PASSWORD_RESET', 'user_master', ?, ?)`, [req.user.user_id, targetUserId.toString(), `Password reset by ${req.user.login_id}`]);
    res.json({ success: true, temp_password: tempPassword, message: 'Password reset. User must change on next login.' });
}
async function listUsers(req, res) {
    const conditions = [];
    const params = [];
    if (req.query.role_code) {
        conditions.push('role_code = ?');
        params.push(req.query.role_code);
    }
    if (req.query.branch) {
        conditions.push('branch_short_name = ?');
        params.push(req.query.branch);
    }
    if (req.query.search) {
        conditions.push('(full_name LIKE ? OR login_id LIKE ?)');
        params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db_1.default.execute(`SELECT u.user_id, u.login_id, u.full_name, u.email, u.mobile,
            u.role_code, r.role_name, u.branch_short_name, u.employee_code,
            u.active_status, u.force_password_change, u.account_locked,
            u.failed_login_attempts, u.last_login_at, u.created_at
     FROM user_master u
     LEFT JOIN role_master r ON r.role_code = u.role_code
     ${where}
     ORDER BY u.full_name`, params);
    res.json({ success: true, data: rows });
}
async function createUser(req, res) {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const { login_id, full_name, email, mobile, role_code, branch_short_name, employee_code } = req.body;
    if (!login_id || !full_name || !role_code) {
        res.status(400).json({ success: false, message: 'login_id, full_name, role_code are required' });
        return;
    }
    const tempPassword = generateTempPassword();
    const hash = await bcryptjs_1.default.hash(tempPassword, 10);
    const [result] = await db_1.default.execute(`INSERT INTO user_master
       (login_id, full_name, email, mobile, role_code, branch_short_name, employee_code, password_hash, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [login_id, full_name, email || null, mobile || null, role_code,
        branch_short_name || null, employee_code || null, hash, req.user.login_id]);
    res.status(201).json({
        success: true,
        data: { user_id: result.insertId, temp_password: tempPassword },
        message: 'User created. Share the temp_password with the user — they must change it on first login.',
    });
}
async function updateUserScope(req, res) {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const targetUserId = parseInt(req.params.userId);
    const { scope_type, branch_short_name, dialdesk_client_id, process_name, business_lob, source_type, employee_code } = req.body;
    // Remove existing scope and replace
    await db_1.default.execute('UPDATE user_scope_mapping SET active_status = 0 WHERE user_id = ?', [targetUserId]);
    await db_1.default.execute(`INSERT INTO user_scope_mapping
       (user_id, scope_type, branch_short_name, dialdesk_client_id, process_name, business_lob, source_type, employee_code, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [targetUserId, scope_type, branch_short_name || null, dialdesk_client_id || null,
        process_name || null, business_lob || null, source_type || null,
        employee_code || null, req.user.login_id]);
    res.json({ success: true, message: 'User scope updated' });
}
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
async function logLoginAttempt(userId, loginId, status, reason, req) {
    try {
        await db_1.default.execute(`INSERT INTO login_audit_log (user_id, login_id, login_status, failure_reason, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`, [userId, loginId, status, reason, req.ip || null,
            req.headers['user-agent']?.substring(0, 500) || null]);
    }
    catch { /* non-critical */ }
}
