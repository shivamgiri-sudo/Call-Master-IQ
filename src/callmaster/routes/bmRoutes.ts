// src/callmaster/routes/bmRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as bm from '../services/branchService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'branch_manager'));

const scope = (req: Request) => ({ branchIds: req.cm!.branch_ids, processIds: req.cm!.process_ids });
const preset = (req: Request): Preset => (req.body?.preset as Preset) || 'MTD';
const wrap = (fn: (req: Request) => Promise<any>) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

router.post('/health',            wrap(req => bm.bmHealth(preset(req), scope(req))));
router.post('/process-breakdown', wrap(req => bm.bmProcessBreakdown(preset(req), scope(req))));
router.post('/team-performance',  wrap(req => bm.bmTeamPerformance(preset(req), scope(req))));
router.post('/daily-sla',         wrap(req => bm.bmDailySla(scope(req))));
router.post('/risk-calls',        wrap(req => bm.bmRiskCalls(preset(req), scope(req))));
router.post('/action-items',      wrap(req => bm.bmActionItems(scope(req))));

export default router;
