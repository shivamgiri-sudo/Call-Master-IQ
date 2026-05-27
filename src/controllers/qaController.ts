import { Request, Response } from 'express';
import {
  createManualAudit, updateManualAudit, getManualAudits,
  getManualAuditById, runAIReaudit
} from '../services/qaAuditService';
import { getCallDetail } from '../services/callQueryService';
import pool from '../config/db';

export async function listAudits(req: Request, res: Response): Promise<void> {
  try {
    const result = await getManualAudits({
      auditor_user_id: req.query.auditor_user_id ? parseInt(req.query.auditor_user_id as string) : undefined,
      client_id: req.query.client_id as string,
      agent_employee_code: req.query.agent_code as string,
      audit_status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createAudit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { source_call_id, source_type, client_id, process_name, business_lob,
            campaign_name, call_date, agent_employee_code, scores,
            manual_remarks, audit_status } = req.body;

    if (!source_call_id || !source_type || !client_id || !scores) {
      res.status(400).json({ success: false, message: 'source_call_id, source_type, client_id, scores are required' });
      return;
    }

    const result = await createManualAudit({
      source_call_id, source_type, auditor_user_id: req.user.user_id,
      client_id, process_name, business_lob, campaign_name, call_date,
      agent_employee_code, scores, manual_remarks, audit_status,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateAudit(req: Request, res: Response): Promise<void> {
  try {
    const audit_id = parseInt(req.params.id as string);
    const existing = await getManualAuditById(audit_id);
    if (!existing) { res.status(404).json({ success: false, message: 'Audit not found' }); return; }

    await updateManualAudit(audit_id, {
      scores: req.body.scores,
      manual_remarks: req.body.manual_remarks,
      audit_status: req.body.audit_status,
    });
    res.json({ success: true, message: 'Audit updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAudit(req: Request, res: Response): Promise<void> {
  try {
    const audit = await getManualAuditById(parseInt(req.params.id as string));
    if (!audit) { res.status(404).json({ success: false, message: 'Audit not found' }); return; }
    res.json({ success: true, data: audit });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function triggerReaudit(req: Request, res: Response): Promise<void> {
  try {
    const call = await getCallDetail(req.params.id as string, req.scopeFilter || {});
    if (!call) { res.status(404).json({ success: false, message: 'Call not found' }); return; }
    if (!call.transcript_text) { res.status(400).json({ success: false, message: 'No transcript available for this call' }); return; }

    // Fetch prompt config for this call's LOB
    const [prompts] = await pool.execute<any[]>(
      `SELECT system_prompt FROM audit_prompt_config
       WHERE client_id = ? AND is_active = 1
         AND (process_name = ? OR process_name IS NULL)
         AND (business_lob = ? OR business_lob IS NULL)
         AND source_type = ?
       ORDER BY process_name DESC, business_lob DESC
       LIMIT 1`,
      [call.client_id, call.process_name, call.business_lob, call.source_type]
    );

    const systemPrompt = prompts[0]?.system_prompt || getDefaultQAPrompt();

    const result = await runAIReaudit(call.transcript_text, {
      system_prompt: systemPrompt,
      process_name: call.process_name,
      business_lob: call.business_lob,
    });

    res.json({ success: true, data: { source_call_id: call.source_call_id, ai_scores: result } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function getDefaultQAPrompt(): string {
  return `You are a call centre quality auditor. Evaluate each transcript against the 20 standard quality parameters. Score 1 for pass, 0 for fail, null if not applicable. Always respond with valid JSON only.`;
}
