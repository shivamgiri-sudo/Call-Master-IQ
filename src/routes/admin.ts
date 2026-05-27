import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  listPrompts, upsertPrompt,
  listEmployees, importEmployees,
  listProcesses, upsertProcess,
  triggerSnapshot
} from '../controllers/adminController';

const router = Router();

router.use(jwtAuth);

// Prompt management (admin/manager roles only)
router.get('/prompts', listPrompts);
router.post('/prompts', requireRole('ADMIN', 'MANAGER'), upsertPrompt);

// Employee management
router.get('/employees', listEmployees);
router.post('/employees/import', requireRole('ADMIN', 'MANAGER'), importEmployees);

// Process mapping
router.get('/processes', listProcesses);
router.post('/processes', requireRole('ADMIN', 'MANAGER'), upsertProcess);

// Snapshot (ADMIN only)
router.post('/snapshot', requireRole('ADMIN'), triggerSnapshot);

export default router;
