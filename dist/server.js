"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = __importDefault(require("./routes/auth"));
const documents_1 = __importDefault(require("./routes/documents"));
const qaAuth_1 = __importDefault(require("./routes/qaAuth"));
const calls_1 = __importDefault(require("./routes/calls"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const qa_1 = __importDefault(require("./routes/qa"));
const coaching_1 = __importDefault(require("./routes/coaching"));
const calibration_1 = __importDefault(require("./routes/calibration"));
const admin_1 = __importDefault(require("./routes/admin"));
const db_1 = require("./config/db");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, morgan_1.default)('dev'));
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        status: 'OK',
        service: 'LexicalSpark API',
        timestamp: new Date().toISOString(),
    });
});
// DB connectivity test — no auth required
app.get('/api/dbtest/ping', async (_req, res) => {
    try {
        const result = await (0, db_1.pingDb)();
        res.json({ success: true, db: result });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// Legacy document routes (kept)
app.use('/api/auth', auth_1.default);
app.use('/api/documents', documents_1.default);
// LexicalSpark auth (user_master based)
app.use('/api/qa-auth', qaAuth_1.default);
// LexicalSpark QA Platform routes
app.use('/api/calls', calls_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/alerts', alerts_1.default);
app.use('/api/qa', qa_1.default);
app.use('/api/coaching', coaching_1.default);
app.use('/api/calibration', calibration_1.default);
app.use('/api/admin', admin_1.default);
const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
    console.log(`LexicalSpark API running on port ${port}`);
});
