"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocument = createDocument;
exports.downloadDocument = downloadDocument;
exports.listDocuments = listDocuments;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const db_1 = require("../config/db");
const aiService_1 = require("../services/aiService");
const pptxService_1 = require("../services/pptxService");
const xlsxService_1 = require("../services/xlsxService");
const docxService_1 = require("../services/docxService");
const pdfService_1 = require("../services/pdfService");
const OUTPUT_DIR = path_1.default.join(process.cwd(), 'outputs');
if (!fs_1.default.existsSync(OUTPUT_DIR))
    fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
const FREE_LIMIT = 5;
async function createDocument(req, res) {
    const userId = req.userId;
    const { title, type, prompt } = req.body;
    if (!title || !type || !prompt) {
        res.status(400).json({ success: false, message: 'title, type, and prompt are required' });
        return;
    }
    const validTypes = ['pptx', 'xlsx', 'docx', 'pdf'];
    if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, message: `type must be one of: ${validTypes.join(', ')}` });
        return;
    }
    // Enforce free tier limit
    const [userRows] = await db_1.db.query('SELECT plan, docs_generated FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    if (user.plan === 'free' && user.docs_generated >= FREE_LIMIT) {
        res.status(403).json({ success: false, message: 'Free plan limit reached. Upgrade to Pro.' });
        return;
    }
    // Insert record as processing
    const [insertResult] = await db_1.db.query('INSERT INTO documents (user_id, title, type, prompt, status) VALUES (?, ?, ?, ?, ?)', [userId, title, type, prompt, 'processing']);
    const docId = insertResult.insertId;
    try {
        // Generate content via AI
        const content = await (0, aiService_1.generateDocumentContent)(prompt, type);
        const filename = `${(0, uuid_1.v4)()}.${type}`;
        const outputPath = path_1.default.join(OUTPUT_DIR, filename);
        // Generate the actual file
        if (type === 'pptx') {
            const { slides } = content;
            await (0, pptxService_1.generatePptx)(slides, OUTPUT_DIR, filename);
        }
        else if (type === 'xlsx') {
            const { sheets } = content;
            await (0, xlsxService_1.generateXlsx)(sheets, OUTPUT_DIR, filename);
        }
        else if (type === 'docx') {
            const { title: docTitle, sections } = content;
            await (0, docxService_1.generateDocx)(docTitle, sections, OUTPUT_DIR, filename);
        }
        else if (type === 'pdf') {
            const { title: docTitle, sections } = content;
            await (0, pdfService_1.generatePdf)(docTitle, sections, OUTPUT_DIR, filename);
        }
        // Update record and increment counter
        await Promise.all([
            db_1.db.query('UPDATE documents SET status = ?, file_path = ? WHERE id = ?', ['done', outputPath, docId]),
            db_1.db.query('UPDATE users SET docs_generated = docs_generated + 1 WHERE id = ?', [userId]),
        ]);
        res.json({ success: true, document: { id: docId, title, type, status: 'done' } });
    }
    catch (err) {
        await db_1.db.query('UPDATE documents SET status = ? WHERE id = ?', ['failed', docId]);
        console.error('Document generation failed:', err);
        res.status(500).json({ success: false, message: 'Document generation failed', error: err.message });
    }
}
async function downloadDocument(req, res) {
    const userId = req.userId;
    const { id } = req.params;
    const [rows] = await db_1.db.query('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, userId]);
    const doc = rows[0];
    if (!doc) {
        res.status(404).json({ success: false, message: 'Document not found' });
        return;
    }
    if (doc.status !== 'done' || !doc.file_path) {
        res.status(400).json({ success: false, message: 'Document is not ready' });
        return;
    }
    if (!fs_1.default.existsSync(doc.file_path)) {
        res.status(404).json({ success: false, message: 'File not found on server' });
        return;
    }
    res.download(doc.file_path, `${doc.title}.${doc.type}`);
}
async function listDocuments(req, res) {
    const userId = req.userId;
    const [rows] = await db_1.db.query('SELECT id, title, type, status, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json({ success: true, documents: rows });
}
