// src/callmaster/routes/cmAuthRoutes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/db';
import { cmAuthMiddleware, CmUser } from '../middleware/cmAuth';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'username and password required' });
    return;
  }

  try {
    const [rows] = await (db as any).execute(
      `SELECT user_id, username, password_hash, full_name, role, branch_ids, process_ids, employee_code
       FROM cm_users WHERE username = ? AND active = 1 LIMIT 1`,
      [username]
    ) as any;

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const payload: Omit<CmUser, never> = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      branch_ids: typeof user.branch_ids === 'string' ? JSON.parse(user.branch_ids) : user.branch_ids,
      process_ids: typeof user.process_ids === 'string' ? JSON.parse(user.process_ids) : user.process_ids,
      employee_code: user.employee_code,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '12h' });
    res.json({ success: true, token, user: payload });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', cmAuthMiddleware, (req: Request, res: Response): void => {
  res.json({ success: true, user: req.cm });
});

export default router;
