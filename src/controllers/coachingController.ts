import { Request, Response } from 'express';
import {
  generateCoachingContent, getCoachingList, getCoachingById,
  assignCoaching, getMyAssignments, updateAssignmentStatus
} from '../services/coachingAIService';
import { getCallList } from '../services/callQueryService';

export async function listCoaching(req: Request, res: Response): Promise<void> {
  try {
    const result = await getCoachingList({
      client_id: req.query.client_id as string,
      business_lob: req.query.business_lob as string,
      defect_parameter: req.query.defect_parameter as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function generateCoaching(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { defect_parameter, process_name, business_lob, source_type, client_id, transcript_excerpts } = req.body;

    if (!defect_parameter || !client_id) {
      res.status(400).json({ success: false, message: 'defect_parameter and client_id are required' });
      return;
    }

    // If no excerpts provided, auto-fetch failing transcripts from the DB
    let excerpts: string[] = transcript_excerpts || [];
    if (excerpts.length === 0) {
      const calls = await getCallList({
        scope: req.scopeFilter || {},
        client_id,
        process_name,
        business_lob,
        source_type,
        limit: 5,
      });
      excerpts = calls.data
        .filter((c: any) => c.transcript_text)
        .map((c: any) => c.transcript_text)
        .slice(0, 5);
    }

    if (excerpts.length === 0) {
      res.status(400).json({ success: false, message: 'No transcript excerpts available — provide transcript_excerpts in body' });
      return;
    }

    const result = await generateCoachingContent({
      defect_parameter, process_name, business_lob, source_type, client_id,
      transcript_excerpts: excerpts,
      created_by_user_id: req.user.user_id,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCoaching(req: Request, res: Response): Promise<void> {
  try {
    const item = await getCoachingById(parseInt(req.params.id as string));
    if (!item) { res.status(404).json({ success: false, message: 'Coaching not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function assign(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { employee_codes } = req.body;
    if (!Array.isArray(employee_codes) || employee_codes.length === 0) {
      res.status(400).json({ success: false, message: 'employee_codes array is required' });
      return;
    }
    await assignCoaching(parseInt(req.params.id as string), employee_codes, req.user.user_id);
    res.json({ success: true, message: `Assigned to ${employee_codes.length} agent(s)` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function myAssignments(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const empCode = req.user.employee_code;
    if (!empCode) { res.json({ success: true, data: [], total: 0 }); return; }
    const result = await getMyAssignments(
      empCode,
      parseInt(req.query.page as string) || 1,
      Math.min(parseInt(req.query.limit as string) || 20, 100)
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!['viewed', 'completed'].includes(status)) {
      res.status(400).json({ success: false, message: "status must be 'viewed' or 'completed'" });
      return;
    }
    await updateAssignmentStatus(parseInt(req.params.id as string), status);
    res.json({ success: true, message: 'Status updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
