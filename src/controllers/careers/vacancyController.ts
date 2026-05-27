import { Request, Response } from 'express';
import {
  listPublishedVacancies,
  getVacancyDetail,
  createVacancy,
  updateVacancy,
  updateVacancyStatus,
  listVacanciesAdmin,
} from '../../services/careers/vacancyService';

export async function listPublicVacancies(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      branch_id: req.query.branch_id as string,
      process_id: req.query.process_id as string,
      job_role_id: req.query.job_role_id as string,
      voice_type: req.query.voice_type as string,
      search: req.query.search as string,
    };
    const data = await listPublishedVacancies(filters);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getPublicVacancyDetail(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const data = await getVacancyDetail(id);
    if (!data) {
      res.status(404).json({ success: false, message: 'Vacancy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminListVacancies(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      branch_id: req.query.branch_id as string,
      process_id: req.query.process_id as string,
      job_role_id: req.query.job_role_id as string,
      vacancy_status: req.query.vacancy_status as string,
      search: req.query.search as string,
      from_date: req.query.from_date as string,
      to_date: req.query.to_date as string,
    };
    const data = await listVacanciesAdmin(filters);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateVacancy(req: Request, res: Response): Promise<void> {
  try {
    const created_by = (req as any).user?.user_id?.toString() || 'system';
    const data = await createVacancy(req.body, created_by);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateVacancy(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const data = await updateVacancy(id, req.body);
    if (!data) {
      res.status(404).json({ success: false, message: 'Vacancy not found or no fields to update' });
      return;
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminUpdateVacancyStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ success: false, message: 'status is required' });
      return;
    }
    const data = await updateVacancyStatus(id, status);
    if (!data) {
      res.status(404).json({ success: false, message: 'Vacancy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
