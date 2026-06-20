/**
 * Analytics Extension Controller — Phase 2 approved endpoints
 * All routes enforce RBAC via jwtAuth + loadUserScope middleware.
 */
import { Request, Response } from 'express';
import * as service from '../services/analyticsExtensionService';

export async function getSplitKPIs(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getSplitKPIs({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      business_lob: req.query.business_lob as string,
      branch_short_name: req.query.branch_short_name as string,
      source_type: req.query.source_type as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else if (err.message === 'INVALID_DATE_FORMAT' || err.message === 'INVALID_DATE_RANGE') {
      res.status(400).json({ success: false, error: err.message, message: 'Invalid date format or range' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getSalesIntelligence(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getSalesIntelligence({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getTNIHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getTNIHeatmap({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getRiskQueue(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getRiskQueue({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getSalesFunnel(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getSalesFunnel({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getLeakageReport(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getLeakageReport({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getComplianceSummary(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getComplianceSummary({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getJourneySummary(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getJourneySummary({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getQualityDistribution(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getQualityDistribution({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getTopBottomAgents(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getTopBottomAgents({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getDrilldown(req: Request, res: Response): Promise<void> {
  try {
    const { dimension, value } = req.body;
    if (!dimension || !value) {
      res.status(400).json({ success: false, error: 'MISSING_PARAMETERS', message: 'dimension and value are required' });
      return;
    }

    const result = await service.getDrilldown(
      {
        scope: req.scopeFilter || {},
        client_id: req.body.client_id as string,
        process_name: req.body.process_name as string,
        from: req.body.from as string,
        to: req.body.to as string,
        page: Number(req.body.page) || undefined,
        limit: Number(req.body.limit) || undefined,
      },
      dimension,
      value
    );
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getSensitiveWords(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getSensitiveWords({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRiskByProcess(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getRiskByProcess({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAnalystDailyTrend(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getAnalystDailyTrend({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message === 'DATE_RANGE_EXCEEDED') {
      res.status(400).json({ success: false, error: 'DATE_RANGE_EXCEEDED', message: 'Date range exceeds maximum allowed days' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export async function getParameterTrend(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.getParameterTrend({
      scope: req.scopeFilter || {},
      client_id: req.query.client_id as string,
      process_name: req.query.process_name as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
