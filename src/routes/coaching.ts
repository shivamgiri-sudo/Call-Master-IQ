import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { loadUserScope } from '../middleware/rbac';
import {
  listCoaching, generateCoaching, getCoaching,
  assign, myAssignments, updateStatus
} from '../controllers/coachingController';

const router = Router();

router.use(jwtAuth, loadUserScope);

router.get('/', listCoaching);
router.post('/generate', generateCoaching);
router.get('/my-assignments', myAssignments);
router.get('/:id', getCoaching);
router.post('/:id/assign', assign);
router.patch('/assignments/:id/status', updateStatus);

export default router;
