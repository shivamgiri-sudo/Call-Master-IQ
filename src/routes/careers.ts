import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

// Vacancy controllers
import {
  listPublicVacancies,
  getPublicVacancyDetail,
  adminListVacancies,
  adminCreateVacancy,
  adminUpdateVacancy,
  adminUpdateVacancyStatus,
} from '../controllers/careers/vacancyController';

// Candidate controllers
import {
  checkDuplicate,
  submitApplication,
  uploadResume,
  getApplicationStatusHandler,
} from '../controllers/careers/candidateController';

// Assessment controllers
import {
  getAssignedAssessment,
  submitScreening,
  getReadingPassageHandler,
  uploadAudio,
  submitReadingScore,
  submitComprehension,
  adminGetScreeningBank,
  adminCreateScreeningSet,
  adminCreateQuestion,
  adminGetPassageBank,
  adminCreatePassage,
  adminGetRules,
  adminCreateRule,
} from '../controllers/careers/assessmentController';

// Pipeline controllers
import {
  getRecruiterQueueHandler,
  scheduleInterviewHandler,
  recordInterviewOutcomeHandler,
  getManualReviewQueueHandler,
  submitManualReviewHandler,
  recordJoiningHandler,
  updateJoiningStatusHandler,
} from '../controllers/careers/pipelineController';

// Dashboard controllers
import {
  getFunnelKPIsHandler,
  getBranchFunnelHandler,
  getVacancyAgeingHandler,
  getReadingScoreDistributionHandler,
  getSourceConversionHandler,
  getStageDropOffHandler,
} from '../controllers/careers/dashboardController';

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

// Vacancy listing / detail (no auth)
router.get('/public/vacancies', listPublicVacancies);
router.get('/public/vacancies/:id', getPublicVacancyDetail);

// Candidate self-service (no auth)
router.post('/public/duplicate-check', checkDuplicate);
router.post('/public/apply', submitApplication);
router.post('/public/resume-upload', uploadResume);
router.get('/public/status', getApplicationStatusHandler);

// Assessment self-service (no auth)
router.get('/public/assessment', getAssignedAssessment);
router.post('/public/screening/submit', submitScreening);
router.get('/public/reading/passage', getReadingPassageHandler);
router.post('/public/reading/audio', uploadAudio);
router.post('/public/reading/score', submitReadingScore);
router.post('/public/comprehension/submit', submitComprehension);

// ─── Admin Routes (require JWT) ───────────────────────────────────────────────

// Vacancy management
router.get('/admin/vacancies', jwtAuth, requireRole('admin', 'recruiter', 'manager'), adminListVacancies);
router.post('/admin/vacancies', jwtAuth, requireRole('admin', 'manager'), adminCreateVacancy);
router.put('/admin/vacancies/:id', jwtAuth, requireRole('admin', 'manager'), adminUpdateVacancy);
router.patch('/admin/vacancies/:id/status', jwtAuth, requireRole('admin', 'manager'), adminUpdateVacancyStatus);

// Screening bank
router.get('/admin/screening-sets', jwtAuth, adminGetScreeningBank);
router.post('/admin/screening-sets', jwtAuth, requireRole('admin', 'manager'), adminCreateScreeningSet);
router.post('/admin/questions', jwtAuth, requireRole('admin', 'manager'), adminCreateQuestion);

// Reading passage bank
router.get('/admin/passages', jwtAuth, adminGetPassageBank);
router.post('/admin/passages', jwtAuth, requireRole('admin', 'manager'), adminCreatePassage);

// Assessment rules
router.get('/admin/rules', jwtAuth, adminGetRules);
router.post('/admin/rules', jwtAuth, requireRole('admin', 'manager'), adminCreateRule);

// Pipeline: F2F queue and interview management
router.get('/admin/pipeline/queue', jwtAuth, requireRole('admin', 'recruiter', 'manager'), getRecruiterQueueHandler);
router.post('/admin/pipeline/interview', jwtAuth, requireRole('admin', 'recruiter', 'manager'), scheduleInterviewHandler);
router.put('/admin/pipeline/interview/:id', jwtAuth, requireRole('admin', 'recruiter', 'manager'), recordInterviewOutcomeHandler);

// Pipeline: Manual review queue
router.get('/admin/pipeline/review-queue', jwtAuth, requireRole('admin', 'recruiter', 'manager'), getManualReviewQueueHandler);
router.post('/admin/pipeline/review', jwtAuth, requireRole('admin', 'recruiter', 'manager'), submitManualReviewHandler);

// Pipeline: Joining
router.post('/admin/pipeline/joining', jwtAuth, requireRole('admin', 'recruiter', 'manager'), recordJoiningHandler);
router.put('/admin/pipeline/joining/:id', jwtAuth, requireRole('admin', 'recruiter', 'manager'), updateJoiningStatusHandler);

// Dashboard
router.get('/admin/dashboard/kpis', jwtAuth, getFunnelKPIsHandler);
router.get('/admin/dashboard/branch-funnel', jwtAuth, getBranchFunnelHandler);
router.get('/admin/dashboard/vacancy-ageing', jwtAuth, getVacancyAgeingHandler);
router.get('/admin/dashboard/score-distribution', jwtAuth, getReadingScoreDistributionHandler);
router.get('/admin/dashboard/source-conversion', jwtAuth, getSourceConversionHandler);
router.get('/admin/dashboard/stage-dropoff', jwtAuth, getStageDropOffHandler);

export default router;
