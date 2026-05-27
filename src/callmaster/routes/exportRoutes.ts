// src/callmaster/routes/exportRoutes.ts
import { Router, Request, Response } from 'express';
import { cmAuthMiddleware } from '../middleware/cmAuth';
import db from '../../config/db';
import { presetToDateRange, safeScopeFilter, Preset } from '../repositories/baseRepository';

const router = Router();
router.use(cmAuthMiddleware);

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => {
      const v = row[h];
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(','));
  }
  return lines.join('\n');
}

function sendCsv(res: Response, filename: string, data: string): void {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
}

async function qDb<T = any>(sql: string, params: any[]): Promise<T[]> {
  const [rows] = await (db as any).execute(sql, params);
  return rows as T[];
}

router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', req.cm!.branch_ids);
    const rows = await qDb(`
      SELECT source_call_id, source_type, process_name, branch_short_name,
             agent_employee_name, alert_severity, call_date
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ? AND alert_severity IN ('Critical','High') AND ${bClause}
      ORDER BY call_date DESC LIMIT 10000
    `, [startDate, endDate, ...bParams]);
    sendCsv(res, `alerts_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/analyst-performance', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const { clause: pClause, params: pParams } = safeScopeFilter('process_name', req.cm!.process_ids);
    const { clause: bClause, params: bParams } = safeScopeFilter('branch_short_name', req.cm!.branch_ids);
    const rows = await qDb(`
      SELECT agent_employee_code, agent_employee_name, process_name, source_type,
             COUNT(*) AS total_calls, ROUND(AVG(quality_score),2) AS avg_score,
             SUM(is_critical_call) AS critical_count
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ? AND ${pClause} AND ${bClause}
        AND quality_score IS NOT NULL
      GROUP BY agent_employee_code, agent_employee_name, process_name, source_type
      ORDER BY avg_score DESC
    `, [startDate, endDate, ...pParams, ...bParams]);
    sendCsv(res, `analyst_performance_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/process-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const p = (req.query.preset as Preset) || 'MTD';
    const { startDate, endDate } = presetToDateRange(p);
    const rows = await qDb(`
      SELECT process_name, source_type,
             COUNT(*) AS total_calls, ROUND(AVG(quality_score),2) AS avg_score,
             SUM(is_critical_call) AS critical_count,
             SUM(CASE WHEN quality_score < 85 THEN 1 ELSE 0 END) AS below_avg_count
      FROM v_call_master_unified_kpi
      WHERE call_date BETWEEN ? AND ?
      GROUP BY process_name, source_type
      ORDER BY avg_score DESC
    `, [startDate, endDate]);
    sendCsv(res, `process_summary_${p}_${startDate}.csv`, toCsv(rows));
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

export default router;
