"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const qaAuthController_1 = require("../controllers/qaAuthController");
const router = (0, express_1.Router)();
// Public
router.post('/login', qaAuthController_1.qaLogin);
// Authenticated
router.post('/change-password', auth_1.jwtAuth, qaAuthController_1.changePassword);
// Admin + Manager only
router.get('/users', auth_1.jwtAuth, (0, rbac_1.requireRole)('ADMIN', 'MANAGER', 'TQ_HEAD', 'HR_HEAD'), qaAuthController_1.listUsers);
router.post('/users', auth_1.jwtAuth, (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), qaAuthController_1.createUser);
router.post('/users/:userId/reset-password', auth_1.jwtAuth, (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), qaAuthController_1.resetUserPassword);
router.put('/users/:userId/scope', auth_1.jwtAuth, (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), qaAuthController_1.updateUserScope);
exports.default = router;
