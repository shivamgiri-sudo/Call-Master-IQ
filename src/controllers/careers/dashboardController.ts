import { Request, Response } from 'express';
import {
  getFunnelKPIs,
  getBranchFunnel,
  getVacancyAgeing,
  getReadingScoreDistribution,
  getSourceConversion,
  getStageDropOff,
} from '../../services/careers/dashboardService';

function buildDashboardFilters(req: Request) {
  return {
    from_date: req.query.from_date as string | undefined,
    to_date: req.query.to_date as string | undefined,
    branch_id: req.query.branch_id as string | undefined,
    process_id: req.query.process_id as string | undefined,
    job_role_id: req.query.job_role_id as string | undefined,
    vacancy_id: req.query.vacancy_id as string | undefined,
  };
}

export async function getFunnelKPIsHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getFunnelKPIs(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getBranchFunnelHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getBranchFunnel(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getVacancyAgeingHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getVacancyAgeing(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getReadingScoreDistributionHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getReadingScoreDistribution(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSourceConversionHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getSourceConversion(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getStageDropOffHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await getStageDropOff(buildDashboardFilters(req));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
