import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import { listAudits, createAudit, updateAudit, getAudit, triggerReaudit } from '../controllers/qaController';

const router = Router();

router.use(jwtAuth, loadUserScope);

router.get('/audits', listAudits);
router.post('/audits', createAudit);
router.get('/audits/:id', getAudit);
router.put('/audits/:id', updateAudit);
router.post('/calls/:id/re-audit', triggerReaudit);

export default router;
