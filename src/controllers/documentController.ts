import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { db } from '../config/db';
import { generateDocumentContent, DocumentType } from '../services/aiService';
import { generatePptx } from '../services/pptxService';
import { generateXlsx } from '../services/xlsxService';
import { generateDocx } from '../services/docxService';
import { generatePdf } from '../services/pdfService';

const OUTPUT_DIR = path.join(process.cwd(), 'outputs');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const FREE_LIMIT = 5;

export async function createDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { title, type, prompt } = req.body;

  if (!title || !type || !prompt) {
    res.status(400).json({ success: false, message: 'title, type, and prompt are required' });
    return;
  }

  const validTypes: DocumentType[] = ['pptx', 'xlsx', 'docx', 'pdf'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ success: false, message: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Enforce free tier limit
  const [userRows] = await db.query('SELECT plan, docs_generated FROM users WHERE id = ?', [userId]) as any[];
  const user = (userRows as any[])[0];
  if (user.plan === 'free' && user.docs_generated >= FREE_LIMIT) {
    res.status(403).json({ success: false, message: 'Free plan limit reached. Upgrade to Pro.' });
    return;
  }

  // Insert record as processing
  const [insertResult] = await db.query(
    'INSERT INTO documents (user_id, title, type, prompt, status) VALUES (?, ?, ?, ?, ?)',
    [userId, title, type, prompt, 'processing']
  ) as any[];
  const docId = (insertResult as any).insertId;

  try {
    // Generate content via AI
    const content = await generateDocumentContent(prompt, type as DocumentType);
    const filename = `${uuidv4()}.${type}`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Generate the actual file
    if (type === 'pptx') {
      const { slides } = content as any;
      await generatePptx(slides, OUTPUT_DIR, filename);
    } else if (type === 'xlsx') {
      const { sheets } = content as any;
      await generateXlsx(sheets, OUTPUT_DIR, filename);
    } else if (type === 'docx') {
      const { title: docTitle, sections } = content as any;
      await generateDocx(docTitle, sections, OUTPUT_DIR, filename);
    } else if (type === 'pdf') {
      const { title: docTitle, sections } = content as any;
      await generatePdf(docTitle, sections, OUTPUT_DIR, filename);
    }

    // Update record and increment counter
    await Promise.all([
      db.query('UPDATE documents SET status = ?, file_path = ? WHERE id = ?', ['done', outputPath, docId]),
      db.query('UPDATE users SET docs_generated = docs_generated + 1 WHERE id = ?', [userId]),
    ]);

    res.json({ success: true, document: { id: docId, title, type, status: 'done' } });
  } catch (err: any) {
    await db.query('UPDATE documents SET status = ? WHERE id = ?', ['failed', docId]);
    console.error('Document generation failed:', err);
    res.status(500).json({ success: false, message: 'Document generation failed', error: err.message });
  }
}

export async function downloadDocument(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const { id } = req.params;

  const [rows] = await db.query(
    'SELECT * FROM documents WHERE id = ? AND user_id = ?',
    [id, userId]
  ) as any[];
  const doc = (rows as any[])[0];

  if (!doc) {
    res.status(404).json({ success: false, message: 'Document not found' });
    return;
  }
  if (doc.status !== 'done' || !doc.file_path) {
    res.status(400).json({ success: false, message: 'Document is not ready' });
    return;
  }
  if (!fs.existsSync(doc.file_path)) {
    res.status(404).json({ success: false, message: 'File not found on server' });
    return;
  }

  res.download(doc.file_path, `${doc.title}.${doc.type}`);
}

export async function listDocuments(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const [rows] = await db.query(
    'SELECT id, title, type, status, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  ) as any[];
  res.json({ success: true, documents: rows });
}
