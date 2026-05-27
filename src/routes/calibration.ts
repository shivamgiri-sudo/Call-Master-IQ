import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import {
  createSession, listSessions, addCallsToSession,
  getSessionReport, closeSession
} from '../controllers/calibrationController';

const router = Router();

router.use(jwtAuth, loadUserScope);

router.post('/sessions', createSession);
router.get('/sessions', listSessions);
router.post('/sessions/:id/calls', addCallsToSession);
router.get('/sessions/:id/report', getSessionReport);
router.put('/sessions/:id/close', closeSession);

export default router;
