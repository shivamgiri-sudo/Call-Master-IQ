import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import {
  dashboard, agentPerformance, branchPerformance, processPerformance,
  qualityTrends, parameterRates, dailyReport
} from '../controllers/analyticsController';

const router = Router();

router.use(jwtAuth, loadUserScope);

router.get('/dashboard', dashboard);
router.get('/agent', agentPerformance);
router.get('/branch', branchPerformance);
router.get('/process', processPerformance);
router.get('/trends', qualityTrends);
router.get('/parameters', parameterRates);
router.get('/daily-report', dailyReport);

export default router;
