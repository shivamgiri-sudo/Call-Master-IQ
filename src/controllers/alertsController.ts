import { Request, Response } from 'express';
import { getAlerts, acknowledgeAlert, getCriticalCalls } from '../services/alertService';

export async function listAlerts(req: Request, res: Response): Promise<void> {
  try {
    const result = await getAlerts(req.scopeFilter || {}, {
      severity: req.query.severity as string,
      alert_type: req.query.alert_type as string,
      is_acknowledged: req.query.is_acknowledged as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function ackAlert(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    await acknowledgeAlert(parseInt(req.params.id as string), req.user.user_id);
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listCriticalCalls(req: Request, res: Response): Promise<void> {
  try {
    const result = await getCriticalCalls(req.scopeFilter || {}, {
      from: req.query.from as string,
      to: req.query.to as string,
      client_id: req.query.client_id as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
