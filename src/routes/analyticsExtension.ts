/**
 * Analytics Extension Routes — Phase 2 approved endpoints
 * All routes require jwtAuth + loadUserScope (RBAC enforcement).
 */
import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import * as controller from '../controllers/analyticsExtensionController';

const router = Router();

// All routes require authentication and scope loading
router.use(jwtAuth);
router.use(loadUserScope);

// Phase 2 approved analytics extension endpoints
router.get('/split-kpis', controller.getSplitKPIs);
router.get('/sales-intelligence', controller.getSalesIntelligence);
router.get('/sales-funnel', controller.getSalesFunnel);
router.get('/leakage-report', controller.getLeakageReport);
router.get('/risk-queue', controller.getRiskQueue);
router.get('/tni-heatmap', controller.getTNIHeatmap);
router.post('/drilldown', controller.getDrilldown);
router.get('/compliance-summary', controller.getComplianceSummary);
router.get('/journey-summary', controller.getJourneySummary);
router.get('/quality-distribution', controller.getQualityDistribution);
router.get('/top-bottom-agents', controller.getTopBottomAgents);
router.get('/sensitive-words', controller.getSensitiveWords);
router.get('/risk-by-process', controller.getRiskByProcess);
router.get('/analyst-daily-trend', controller.getAnalystDailyTrend);
router.get('/parameter-trend', controller.getParameterTrend);

export default router;
