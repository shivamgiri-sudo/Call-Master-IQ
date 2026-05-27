import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import qaAuthRoutes from './routes/qaAuth';
import callRoutes from './routes/calls';
import analyticsRoutes from './routes/analytics';
import alertRoutes from './routes/alerts';
import qaRoutes from './routes/qa';
import coachingRoutes from './routes/coaching';
import calibrationRoutes from './routes/calibration';
import adminRoutes from './routes/admin';
import hrmsRoutes from './routes/hrms';
import careersRoutes from './routes/careers';
import cmAuthRoutes from './callmaster/routes/cmAuthRoutes';
import ceoRoutes from './callmaster/routes/ceoRoutes';
import tqRoutes from './callmaster/routes/tqRoutes';
import { pingDb } from './config/db';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

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
    const result = await pingDb();
    res.json({ success: true, db: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Legacy document routes (kept)
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// LexicalSpark auth (user_master based)
app.use('/api/qa-auth', qaAuthRoutes);

// LexicalSpark QA Platform routes
app.use('/api/calls', callRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/calibration', calibrationRoutes);
app.use('/api/admin', adminRoutes);

// HRMS Workforce OS routes
app.use('/api/hrms', hrmsRoutes);

// People Pulse Careers & Smart Screening Portal routes
app.use('/api/careers', careersRoutes);

// Call Master Dashboard
app.use('/api/callmaster/auth', cmAuthRoutes);
app.use('/api/callmaster/ceo', ceoRoutes);
app.use('/api/callmaster/tq', tqRoutes);
app.use('/callmaster', express.static(path.join(__dirname, '..', 'public', 'callmaster')));

const port = Number(process.env.PORT || 5050);

app.listen(port, () => {
  console.log(`LexicalSpark API running on port ${port}`);
});
