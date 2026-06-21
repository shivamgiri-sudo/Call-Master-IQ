import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  getRoleMatrix,
  getUser,
  listPermissions,
  listRoles,
  listUsers as listAdminUsers,
  requireAdminReadAccess,
} from '../controllers/adminUserController';
import {
  listPrompts, upsertPrompt,
  listEmployees, importEmployees,
  listProcesses, upsertProcess,
  triggerSnapshot
} from '../controllers/adminController';

const router = Router();

router.use(jwtAuth);

// Safe read-only user/role management APIs for enterprise UI.
router.get('/users', requireAdminReadAccess, listAdminUsers);
router.get('/users/:id', requireAdminReadAccess, getUser);
router.get('/roles', requireAdminReadAccess, listRoles);
router.get('/permissions', requireAdminReadAccess, listPermissions);
router.get('/role-matrix', requireAdminReadAccess, getRoleMatrix);

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
