import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import {
  listCalls,
  callDetail,
  getInsight,
  generateInsight,
  getFilterOptions,
} from '../controllers/callsController';

const router = Router();

router.use(jwtAuth, loadUserScope);

// Phase-2 routes
router.get('/', listCalls);
router.get('/filter-options', getFilterOptions);
router.get('/filter-values', getFilterOptions); // alias — frontend uses /filter-values
router.get('/:sourceType/:callId/insight', getInsight);
router.post('/:sourceType/:callId/generate-insight', generateInsight);
router.get('/:sourceType/:callId', callDetail);

export default router;
