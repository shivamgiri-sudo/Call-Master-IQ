import { Request, Response } from 'express';
import {
  getDashboardKPIs,
  getAgentPerformance,
  getBranchPerformance,
  getProcessPerformance,
  getQualityTrends,
  getParameterFailureRates,
  getDailyReport,
} from '../services/analyticsService';
import { getDashboardSummary, buildRoleInsight } from '../services/dashboard.service';

function buildFilter(req: Request) {
  return {
    scope: req.scopeFilter || {},
    client_id: req.query.client_id as string,
    from: req.query.from as string,
    to: req.query.to as string,
    source_type: req.query.source_type as string,
    process_name: req.query.process_name as string,
    business_lob: req.query.business_lob as string,
    branch_short_name: req.query.branch_short_name as string,
  };
}

/**
 * GET /api/analytics/dashboard
 * Returns summary + branch_process_performance + trend from the KPI view.
 */
export async function dashboard(req: Request, res: Response): Promise<void> {
  try {
    const startDate =
      typeof req.query.startDate === 'string'
        ? req.query.startDate
        : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const endDate =
      typeof req.query.endDate === 'string'
        ? req.query.endDate
        : new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const data = await getDashboardSummary(req.user, startDate, endDate);
    res.json({
      success: true,
      data: {
        role: req.user?.role_code || 'CEO',
        date_range: { startDate, endDate },
        ...data,
        ai_insight: buildRoleInsight(req.user?.role_code),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function agentPerformance(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAgentPerformance(buildFilter(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function branchPerformance(req: Request, res: Response): Promise<void> {
  try {
    const data = await getBranchPerformance(buildFilter(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function processPerformance(req: Request, res: Response): Promise<void> {
  try {
    const data = await getProcessPerformance(buildFilter(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function qualityTrends(req: Request, res: Response): Promise<void> {
  try {
    const granularity = (req.query.granularity as 'daily' | 'weekly') || 'daily';
    const data = await getQualityTrends(buildFilter(req), granularity);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function parameterRates(req: Request, res: Response): Promise<void> {
  try {
    const data = await getParameterFailureRates(buildFilter(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function dailyReport(req: Request, res: Response): Promise<void> {
  try {
    const data = await getDailyReport(buildFilter(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
