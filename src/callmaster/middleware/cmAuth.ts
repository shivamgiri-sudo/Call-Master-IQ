// src/callmaster/middleware/cmAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface CmUser {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'ceo' | 'tq_head' | 'branch_manager' | 'process_manager' | 'analyst';
  branch_ids: string[];
  process_ids: string[];
  employee_code: string | null;
}

declare global {
  namespace Express {
    interface Request {
      cm?: CmUser;
    }
  }
}

export function cmAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as CmUser & { iat: number; exp: number };
    req.cm = {
      user_id: payload.user_id,
      username: payload.username,
      full_name: payload.full_name,
      role: payload.role,
      branch_ids: payload.branch_ids,
      process_ids: payload.process_ids,
      employee_code: payload.employee_code,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: CmUser['role'][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.cm || !roles.includes(req.cm.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
}
