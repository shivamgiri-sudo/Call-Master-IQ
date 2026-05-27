import { Request, Response } from 'express';
import pool from '../config/db';
import { getCallDetail } from '../services/callQueryService';

export async function createSession(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { session_name, client_id, process_name, source_type } = req.body;
    if (!session_name || !client_id || !source_type) {
      res.status(400).json({ success: false, message: 'session_name, client_id, source_type are required' });
      return;
    }
    const [result] = await pool.execute<any>(
      `INSERT INTO calibration_session (session_name, client_id, process_name, source_type, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [session_name, client_id, process_name || null, source_type, req.user.user_id]
    );
    res.status(201).json({ success: true, data: { session_id: result.insertId } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT cs.*, um.full_name AS created_by_name
       FROM calibration_session cs
       LEFT JOIN user_master um ON um.user_id = cs.created_by_user_id
       ORDER BY cs.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function addCallsToSession(req: Request, res: Response): Promise<void> {
  try {
    const session_id = parseInt(req.params.id as string);
    const { call_ids } = req.body;
    if (!Array.isArray(call_ids) || call_ids.length === 0) {
      res.status(400).json({ success: false, message: 'call_ids array is required' });
      return;
    }

    for (const call_id of call_ids) {
      const call = await getCallDetail(call_id, req.scopeFilter || {});
      if (!call) continue;

      // Check if manual audit exists
      const [audits] = await pool.execute<any[]>(
        'SELECT audit_id, manual_quality_percentage FROM manual_qa_audit WHERE source_call_id = ? LIMIT 1',
        [call_id]
      );
      const manualAudit = audits[0] || null;

      let variance: number | null = null;
      if (manualAudit && call.quality_score !== null) {
        variance = parseFloat((parseFloat(manualAudit.manual_quality_percentage) - parseFloat(call.quality_score)).toFixed(2));
      }

      await pool.execute(
        `INSERT IGNORE INTO calibration_call
           (session_id, source_call_id, manual_audit_id, ai_quality_percentage,
            manual_quality_percentage, variance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [session_id, call_id, manualAudit?.audit_id || null,
         call.quality_score || null,
         manualAudit?.manual_quality_percentage || null,
         variance]
      );
    }

    res.json({ success: true, message: `${call_ids.length} call(s) added to session` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSessionReport(req: Request, res: Response): Promise<void> {
  try {
    const session_id = parseInt(req.params.id as string);

    const [session] = await pool.execute<any[]>(
      'SELECT * FROM calibration_session WHERE session_id = ?', [session_id]
    );
    if (!session[0]) { res.status(404).json({ success: false, message: 'Session not found' }); return; }

    const [calls] = await pool.execute<any[]>(
      `SELECT cc.*, mqa.manual_remarks,
              mqa.customer_concern_acknowledged AS m_concern,
              mqa.professionalism_maintained AS m_professionalism,
              mqa.proper_hold_procedure AS m_hold,
              mqa.correct_and_complete_information AS m_correct_info,
              mqa.proper_call_closure AS m_closure
       FROM calibration_call cc
       LEFT JOIN manual_qa_audit mqa ON mqa.audit_id = cc.manual_audit_id
       WHERE cc.session_id = ?
       ORDER BY ABS(COALESCE(cc.variance, 0)) DESC`,
      [session_id]
    );

    const totalCalls = calls.length;
    const withBoth = calls.filter((c: any) => c.ai_quality_percentage !== null && c.manual_quality_percentage !== null);
    const avgVariance = withBoth.length > 0
      ? parseFloat((withBoth.reduce((s: number, c: any) => s + Math.abs(c.variance || 0), 0) / withBoth.length).toFixed(2))
      : null;

    res.json({
      success: true,
      data: {
        session: session[0],
        calls,
        summary: { total_calls: totalCalls, calibrated: withBoth.length, avg_variance: avgVariance },
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function closeSession(req: Request, res: Response): Promise<void> {
  try {
    const session_id = parseInt(req.params.id as string);
    const { prompt_improvement_notes, discrepancy_summary } = req.body;
    await pool.execute(
      `UPDATE calibration_session
       SET session_status = 'closed', prompt_improvement_notes = ?, discrepancy_summary = ?
       WHERE session_id = ?`,
      [prompt_improvement_notes || null, discrepancy_summary || null, session_id]
    );
    res.json({ success: true, message: 'Session closed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
