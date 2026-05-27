import { Router } from 'express';
import {
  getQuality,
  getOperations,
  getPerformance,
  getQualitySummaryReport,
  getOperationsSummaryReport,
  getAttendanceSummaryReport,
  getAtsPipelineReport,
} from '../controllers/hrmsController';

const router = Router();

// HRMS Command Center endpoints
// Query params accepted by all routes: from_date, to_date, branch, process, team
router.get('/quality', getQuality);
router.get('/operations', getOperations);
router.get('/performance', getPerformance);

// Phase 8J — Report / export endpoints
// Query params: from_date, to_date, branch, process, format (json|csv)
router.get('/reports/quality-summary',    getQualitySummaryReport);
router.get('/reports/operations-summary', getOperationsSummaryReport);
router.get('/reports/attendance-summary', getAttendanceSummaryReport);
router.get('/reports/ats-pipeline',       getAtsPipelineReport);

export default router;
