import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import { listAlerts, ackAlert, listCriticalCalls, getUnreadCount } from '../controllers/alertsController';

const router = Router();

router.use(jwtAuth, loadUserScope);

router.get('/', listAlerts);
router.get('/unread-count', getUnreadCount);
router.get('/critical-calls', listCriticalCalls);
router.post('/:id/acknowledge', ackAlert);

export default router;
