import { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import {
  checkDuplicate as checkDuplicateService,
  createCandidate,
  createApplication,
  saveConsentLog,
  getApplicationStatus,
  linkResumeAsset,
} from '../../services/careers/candidateService';
import { getVacancyDetail } from '../../services/careers/vacancyService';

// Multer config — memory storage; real projects would pipe to S3/GCS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  },
});

export const resumeUploadMiddleware = upload.single('resume');

export async function checkDuplicate(req: Request, res: Response): Promise<void> {
  try {
    const { mobile, email } = req.body;
    if (!mobile) {
      res.status(400).json({ success: false, message: 'mobile is required' });
      return;
    }
    const duplicate = await checkDuplicateService(mobile, email);
    res.json({
      success: true,
      data: {
        is_duplicate: !!duplicate,
        existing: duplicate
          ? {
              candidate_code: duplicate.candidate_code,
              full_name: duplicate.full_name,
              created_at: duplicate.created_at,
            }
          : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitApplication(req: Request, res: Response): Promise<void> {
  try {
    const {
      // Candidate fields
      full_name, mobile, email, dob, gender,
      highest_qualification, total_experience_months,
      current_city, current_pincode, source, sub_source, referral_code,
      // Application fields
      vacancy_id,
      // Consent fields
      consent_version,
    } = req.body;

    if (!full_name || !mobile || !vacancy_id) {
      res.status(400).json({ success: false, message: 'full_name, mobile and vacancy_id are required' });
      return;
    }

    // Validate vacancy exists and is published
    const vacancy = await getVacancyDetail(vacancy_id);
    if (!vacancy) {
      res.status(404).json({ success: false, message: 'Vacancy not found' });
      return;
    }
    if (vacancy.vacancy_status !== 'Published') {
      res.status(400).json({ success: false, message: 'This vacancy is no longer accepting applications' });
      return;
    }

    // Check for duplicate by mobile
    const existing = await checkDuplicateService(mobile, email);
    let candidate;

    if (existing) {
      // Re-use existing candidate profile
      candidate = existing;
    } else {
      candidate = await createCandidate({
        full_name, mobile, email, dob, gender,
        highest_qualification, total_experience_months,
        current_city, current_pincode,
        source: source || 'Portal',
        sub_source, referral_code,
      });
    }

    // Create application
    const application = await createApplication(
      candidate.candidate_id,
      vacancy_id,
      source || 'Portal',
      vacancy.assessment_rule_id || ''
    );

    // Save consent log
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    await saveConsentLog(
      candidate.candidate_id,
      'data_processing',
      consent_version || '1.0',
      ip,
      ua
    );

    res.status(201).json({
      success: true,
      data: {
        candidate_id: candidate.candidate_id,
        candidate_code: candidate.candidate_code,
        application_id: application.application_id,
        current_stage: application.current_stage,
        vacancy_title: vacancy.vacancy_title,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function uploadResume(req: Request, res: Response): Promise<void> {
  // Run multer middleware inline
  resumeUploadMiddleware(req, res, async (multerErr) => {
    if (multerErr) {
      res.status(400).json({ success: false, message: multerErr.message });
      return;
    }
    try {
      const { application_id } = req.body;
      if (!application_id) {
        res.status(400).json({ success: false, message: 'application_id is required' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Resume file is required' });
        return;
      }

      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();
      const storage_key = `resumes/${application_id}/${Date.now()}${ext}`;

      // In production: upload file.buffer to cloud storage using storage_key
      // Here we record the asset metadata
      const asset = await linkResumeAsset(
        application_id,
        storage_key,
        file.originalname,
        file.mimetype,
        file.size
      );

      res.json({ success: true, data: asset });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

export async function getApplicationStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const application_id = req.query.application_id as string;
    if (!application_id) {
      res.status(400).json({ success: false, message: 'application_id is required' });
      return;
    }
    const data = await getApplicationStatus(application_id);
    if (!data) {
      res.status(404).json({ success: false, message: 'Application not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
