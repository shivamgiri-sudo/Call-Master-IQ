import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { AuthUser } from './rbac';

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export async function jwtAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };

    const [rows] = await pool.execute<any[]>(
      `SELECT user_id, login_id, role_code, branch_short_name, employee_code
       FROM user_master WHERE user_id = ? AND active_status = 1 LIMIT 1`,
      [payload.userId]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.user = rows[0] as AuthUser;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
