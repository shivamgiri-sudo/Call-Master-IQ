import { Router } from 'express';
import { jwtAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  qaLogin, changePassword, resetPasswordByLoginId, resetUserPassword,
  listUsers, createUser, updateUserScope
} from '../controllers/qaAuthController';

const router = Router();

// Public
router.post('/login', qaLogin);

// Authenticated
router.post('/change-password', jwtAuth, changePassword);

// Admin/TQ_HEAD flat reset endpoint (login_id in body, self-reset blocked)
router.post('/reset-password', jwtAuth, requireRole('ADMIN', 'TQ_HEAD'), resetPasswordByLoginId);

// Admin + Manager user management
router.get('/users', jwtAuth, requireRole('ADMIN', 'MANAGER', 'TQ_HEAD', 'HR_HEAD'), listUsers);
router.post('/users', jwtAuth, requireRole('ADMIN', 'MANAGER'), createUser);
router.post('/users/:userId/reset-password', jwtAuth, requireRole('ADMIN', 'MANAGER'), resetUserPassword);
router.put('/users/:userId/scope', jwtAuth, requireRole('ADMIN', 'MANAGER'), updateUserScope);

export default router;
