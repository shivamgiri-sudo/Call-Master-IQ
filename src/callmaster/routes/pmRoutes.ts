// src/callmaster/routes/pmRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware, requireRole } from '../middleware/cmAuth';
import * as pm from '../services/processService';

const router = Router();
router.use(cmAuthMiddleware);
router.use(requireRole('admin', 'process_manager'));

// ---------------------------------------------------------------------------
// Helper: validate processName and enforce process_manager scoping
// ---------------------------------------------------------------------------

function getProcessName(req: Request, res: Response): string | null {
  const processName: string | undefined = req.body?.processName;
  if (!processName) {
    res.status(400).json({ success: false, error: 'processName is required' });
    return null;
  }

  const user = req.cm!;
  // process_manager can only query processes they are assigned to,
  // unless process_ids contains '*' (or user is admin)
  if (user.role === 'process_manager') {
    const allowed = user.process_ids;
    if (!allowed.includes('*') && !allowed.includes(processName)) {
      res.status(403).json({ success: false, error: 'Access denied for this process' });
      return null;
    }
  }

  return processName;
}

function buildParams(req: Request) {
  const { processName, preset = 'MTD', startDate, endDate, page, pageSize, search, lob } = req.body;
  return { processName, preset, startDate, endDate, page, pageSize, search, lob };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post('/my-processes', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.cm!;
    const params = buildParams(req);
    // Build the list of process IDs this user can see
    const processIds: string[] =
      user.role === 'admin'
        ? []  // admin passes empty → service will use its own filter
        : (user.process_ids.includes('*') ? [] : user.process_ids);
    const data = await pm.pmMyProcesses({ ...params, processIds });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmOverview(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/agent-leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmAgentLeaderboard(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/lob-breakdown', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmLobBreakdown(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fatal-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmFatalAnalysis(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/scenario-breakdown', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmScenarioBreakdown(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/detail-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmDetailAnalysis(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/escalation-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmEscalationAnalysis(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/parameter-breakdown', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmParameterBreakdown(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tni-report', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmTniReport(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/coaching-queue', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmCoachingQueue(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cst-crt-funnel', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmCstCrtFunnel(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/missed-opportunities', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmMissedOpportunities(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/nps-csat', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmNpsCsat(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pitch-stage-analysis', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmPitchStageAnalysis(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/objection-rebuttal', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmObjectionRebuttal(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/outbound-explorer', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmOutboundExplorer(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/inbound-explorer', async (req: Request, res: Response): Promise<void> => {
  try {
    const processName = getProcessName(req, res);
    if (!processName) return;
    const data = await pm.pmInboundExplorer(buildParams(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
