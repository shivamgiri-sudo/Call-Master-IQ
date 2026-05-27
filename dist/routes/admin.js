"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
router.use(auth_1.jwtAuth);
// Prompt management (admin/manager roles only)
router.get('/prompts', adminController_1.listPrompts);
router.post('/prompts', (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), adminController_1.upsertPrompt);
// Employee management
router.get('/employees', adminController_1.listEmployees);
router.post('/employees/import', (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), adminController_1.importEmployees);
// Process mapping
router.get('/processes', adminController_1.listProcesses);
router.post('/processes', (0, rbac_1.requireRole)('ADMIN', 'MANAGER'), adminController_1.upsertProcess);
// Snapshot (ADMIN only)
router.post('/snapshot', (0, rbac_1.requireRole)('ADMIN'), adminController_1.triggerSnapshot);
exports.default = router;
