// src/callmaster/routes/analystRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as analyst from '../services/analystService';
import { getInboundCallDetail } from '../repositories/inboundRepo';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'analyst', 'process_manager', 'tq_head'));

const preset = (req: Request): Preset => (req.body?.preset as Preset) || 'MTD';
const wrap = (fn: (req: Request) => Promise<any>) => async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await fn(req) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
};

const getCode = (req: Request): string => {
  const code = req.cm!.employee_code;
  if (!code) throw new Error('employee_code not set for this user');
  return code;
};

router.post('/overview',   wrap(req => analyst.myOverview(preset(req), getCode(req))));
router.post('/defects',    wrap(req => analyst.myDefects(preset(req), getCode(req))));
router.post('/my-calls',   wrap(req => analyst.myCalls(preset(req), getCode(req), Number(String(req.body?.page || 1)), 50)));
router.post('/trend',      wrap(req => analyst.myTrend(getCode(req))));
router.get('/coaching',    wrap(req => analyst.myCoachingNotes(getCode(req))));
router.get('/call/:id',    wrap(req => getInboundCallDetail(String(req.params.id))));

export default router;
