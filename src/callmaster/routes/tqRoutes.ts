// src/callmaster/routes/tqRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as quality from '../services/qualityService';
import db from '../../config/db';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'tq_head'));

function scope(req: Request) {
  return { branchIds: req.cm!.branch_ids, processIds: req.cm!.process_ids };
}
function preset(req: Request): Preset {
  return (req.body?.preset as Preset) || 'MTD';
}

router.post('/quality-deepdive', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqQualityDeepdive(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/leaderboard', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqLeaderboard(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/tni-heatmap', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqTniHeatmap(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/coaching-queue', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqCoachingQueue(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/calibration', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqCalibration(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/audit-efficiency', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqAuditEfficiency(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/parameter-drift', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqParameterDrift(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sla-tracker', async (req, res): Promise<void> => {
  try { res.json({ success: true, data: await quality.tqSlaTracker(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/feedback-queue', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || 'pending';
    const data = await quality.getFeedbackQueue(status);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/feedback/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.cm!;
    const feedbackId = Number(req.params.id);
    const { resolution } = req.body;
    if (!resolution || !['approved', 'rejected'].includes(resolution)) {
      res.status(400).json({ success: false, error: 'resolution must be approved or rejected' });
      return;
    }
    await quality.resolveFeedback({ feedbackId, resolution, resolvedBy: user.user_id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/coaching-notes', async (req, res): Promise<void> => {
  try {
    const { agent_employee_code, process_name, coaching_title, coaching_reason, priority, due_date, source_call_id } = req.body;
    await (db as any).execute(
      `INSERT INTO call_coaching_queue
         (source_type, source_call_id, process_name, agent_employee_code, assigned_to, coaching_title, coaching_reason, priority, due_date)
       VALUES ('Manual', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [source_call_id || null, process_name, agent_employee_code, req.cm!.full_name,
       coaching_title, coaching_reason, priority || 'Medium', due_date || null]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
