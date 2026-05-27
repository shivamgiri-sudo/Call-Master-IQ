import { Request, Response } from 'express';
import {
  getRecruiterQueue,
  scheduleInterview,
  recordInterviewOutcome,
  getManualReviewQueue,
  recordManualReview,
  recordJoining,
  updateJoiningStatus,
} from '../../services/careers/pipelineService';

export async function getRecruiterQueueHandler(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      recruiter_id: req.query.recruiter_id as string | undefined,
      branch_id: req.query.branch_id as string | undefined,
      process_id: req.query.process_id as string | undefined,
      stage: req.query.stage as string | undefined,
    };
    const data = await getRecruiterQueue(filters);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function scheduleInterviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { application_id, round_type, scheduled_at, interviewer_id } = req.body;
    if (!application_id || !round_type || !scheduled_at || !interviewer_id) {
      res.status(400).json({
        success: false,
        message: 'application_id, round_type, scheduled_at and interviewer_id are required',
      });
      return;
    }
    const data = await scheduleInterview(application_id, round_type, scheduled_at, interviewer_id);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function recordInterviewOutcomeHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { attended, outcome, remarks } = req.body as { attended?: number | string; outcome?: string; remarks?: string };
    if (attended === undefined || !outcome) {
      res.status(400).json({ success: false, message: 'attended and outcome are required' });
      return;
    }
    const data = await recordInterviewOutcome(id, Number(attended), outcome, remarks || '');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getManualReviewQueueHandler(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      branch_id: req.query.branch_id as string | undefined,
      process_id: req.query.process_id as string | undefined,
      reviewer_id: req.query.reviewer_id as string | undefined,
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
    };
    const data = await getManualReviewQueue(filters);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitManualReviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { application_id, outcome, remarks } = req.body;
    if (!application_id || !outcome) {
      res.status(400).json({ success: false, message: 'application_id and outcome are required' });
      return;
    }
    const reviewer_id = (req as any).user?.user_id?.toString() || 'system';
    const data = await recordManualReview(application_id, reviewer_id, outcome, remarks || '');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function recordJoiningHandler(req: Request, res: Response): Promise<void> {
  try {
    const { application_id, expected_doj } = req.body;
    if (!application_id || !expected_doj) {
      res.status(400).json({ success: false, message: 'application_id and expected_doj are required' });
      return;
    }
    const data = await recordJoining(application_id, expected_doj);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateJoiningStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { joined_status, actual_doj } = req.body as { joined_status?: string; actual_doj?: string };
    if (!joined_status) {
      res.status(400).json({ success: false, message: 'joined_status is required' });
      return;
    }
    const data = await updateJoiningStatus(id, joined_status, actual_doj);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
