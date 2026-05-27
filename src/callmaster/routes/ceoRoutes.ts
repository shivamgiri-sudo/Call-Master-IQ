// src/callmaster/routes/ceoRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import { Preset } from '../repositories/baseRepository';
import * as org from '../services/orgService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'ceo'));

function scope(req: Request) {
  return {
    branchIds:  req.cm!.branch_ids,
    processIds: req.cm!.process_ids,
  };
}

function preset(req: Request): Preset {
  return (req.body?.preset as Preset) || 'MTD';
}

router.post('/scorecard', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoScorecard(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/process-matrix', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoProcessMatrix(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/branch-comparison', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoBranchComparison(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/sla-overview', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoSlaOverview(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/risk-exposure', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoRiskExposure(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/trend', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoTrend(scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/alerts', async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, data: await org.ceoAlerts(preset(req), scope(req)) }); }
  catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
