// src/callmaster/routes/adminRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import jwt from 'jsonwebtoken';
import * as admin from '../services/adminService';
import db from '../../config/db';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin'));

const wrap = (fn: (req: Request) => Promise<any>) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

// Users
router.get('/users',                     wrap(() => admin.listUsers()));
router.get('/users/:id',                 wrap(req => admin.getUserById(Number(req.params.id))));
router.post('/users',                    wrap(req => admin.createUser(req.body)));
router.put('/users/:id',                 wrap(req => admin.updateUser(Number(req.params.id), req.body)));
router.patch('/users/:id/deactivate',    wrap(req => admin.deactivateUser(Number(req.params.id))));
router.delete('/users/:id',              wrap(req => admin.deleteUser(Number(req.params.id))));
router.post('/users/:id/reset-password', wrap(req => admin.resetUserPassword(Number(req.params.id), req.body.new_password)));

// Employees
router.get('/employees',                 wrap(req => admin.listEmployees(req.query as any)));
router.post('/employees',                wrap(req => admin.createEmployee(req.body)));
router.put('/employees/:id',             wrap(req => admin.updateEmployee(Number(req.params.id), req.body)));
router.delete('/employees/:id',          wrap(req => admin.deleteEmployee(Number(req.params.id))));
router.post('/employees/bulk-import',    wrap(req => admin.bulkImportEmployees(req.body.rows)));

// Agent Aliases
router.get('/aliases',                   wrap(req => admin.listAliases(req.query.process_name as string | undefined)));
router.post('/aliases',                  wrap(req => admin.createAlias(req.body)));
router.put('/aliases/:id',               wrap(req => admin.updateAlias(Number(req.params.id), req.body)));
router.delete('/aliases/:id',            wrap(req => admin.deleteAlias(Number(req.params.id))));
router.post('/aliases/bulk-import',      wrap(req => admin.bulkImportAliases(req.body.rows)));

// Processes
router.get('/processes',                 wrap(() => admin.listProcesses()));
router.post('/processes',                wrap(req => admin.createProcess(req.body)));
router.put('/processes/:id',             wrap(req => admin.updateProcess(Number(req.params.id), req.body)));
router.delete('/processes/:id',          wrap(req => admin.deleteProcess(Number(req.params.id))));

// Exclusion Rules
router.get('/exclusions',                wrap(() => admin.listExclusionRules()));
router.post('/exclusions',               wrap(req => admin.createExclusionRule({ ...req.body, created_by: req.cm!.username })));
router.put('/exclusions/:id',            wrap(req => admin.updateExclusionRule(Number(req.params.id), req.body)));
router.delete('/exclusions/:id',         wrap(req => admin.deleteExclusionRule(Number(req.params.id))));

// Coaching
router.get('/coaching',                  wrap(req => admin.listCoachingQueue(req.query as any)));
router.post('/coaching',                 wrap(req => admin.createCoachingEntry(req.body)));
router.put('/coaching/:id',              wrap(req => admin.updateCoachingEntry(Number(req.params.id), req.body)));
router.post('/coaching/bulk-close',      wrap(req => admin.bulkCloseCoaching(req.body.ids)));

// Calibration
router.get('/calibration/sessions',           wrap(req => admin.listCalibrationSessions(req.query as any)));
router.post('/calibration/sessions',          wrap(req => admin.createCalibrationSession(req.body)));
router.put('/calibration/sessions/:id',       wrap(req => admin.updateCalibrationSession(Number(req.params.id), req.body)));
router.get('/calibration/sessions/:id/calls', wrap(req => admin.listCalibrationCalls(Number(req.params.id))));
router.post('/calibration/calls',             wrap(req => admin.addCalibrationCall(req.body)));

// Audit Prompts
router.get('/audit-prompts',             wrap(req => admin.listAuditPrompts(req.query.process_name as string | undefined)));
router.post('/audit-prompts',            wrap(req => admin.createAuditPrompt(req.body)));
router.put('/audit-prompts/:id',         wrap(req => admin.updateAuditPrompt(Number(req.params.id), req.body)));
router.delete('/audit-prompts/:id',      wrap(req => admin.deleteAuditPrompt(Number(req.params.id))));

// System Health
router.get('/system-health',             wrap(() => admin.systemHealth()));

// Impersonate
router.post('/impersonate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { target_user_id } = req.body;
    const [rows] = await (db as any).execute(
      `SELECT user_id, username, full_name, role, branch_ids, process_ids, employee_code
       FROM cm_users WHERE user_id = ? AND active = 1 LIMIT 1`,
      [target_user_id]
    ) as [any[]];
    if (!rows.length) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const u = rows[0];
    const payload = {
      user_id: u.user_id, username: u.username, full_name: u.full_name,
      role: u.role,
      branch_ids:  typeof u.branch_ids  === 'string' ? JSON.parse(u.branch_ids)  : (u.branch_ids  ?? ['*']),
      process_ids: typeof u.process_ids === 'string' ? JSON.parse(u.process_ids) : (u.process_ids ?? ['*']),
      employee_code: u.employee_code ?? null,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.json({ success: true, token, user: payload });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
