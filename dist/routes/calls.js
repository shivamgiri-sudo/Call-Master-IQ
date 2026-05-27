"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const callsController_1 = require("../controllers/callsController");
const router = (0, express_1.Router)();
router.use(auth_1.jwtAuth, rbac_1.loadUserScope);
// Phase-2 routes
router.get('/', callsController_1.listCalls);
router.get('/filter-options', callsController_1.getFilterOptions);
router.get('/:sourceType/:callId/insight', callsController_1.getInsight);
router.post('/:sourceType/:callId/generate-insight', callsController_1.generateInsight);
router.get('/:sourceType/:callId', callsController_1.callDetail);
exports.default = router;
