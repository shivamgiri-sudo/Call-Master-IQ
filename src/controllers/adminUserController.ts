import { Request, Response, NextFunction } from 'express';
import * as service from '../services/adminUserService';

export function requireAdminReadAccess(req: Request, res: Response, next: NextFunction): void {
  const role = String(req.user?.role_code || '').toUpperCase();
  if (!req.user) {
    res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' });
    return;
  }
  if (!service.ADMIN_ROLES.includes(role as any)) {
    res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Admin read access required' });
    return;
  }
  next();
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.listSafeUsers({
      search: req.query.search as string | undefined,
      role: req.query.role as string | undefined,
      status: req.query.status as string | undefined,
      limit: Number(req.query.limit) || undefined,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    handleAdminError(err, res);
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  try {
    const user = await service.getSafeUserById(String(req.params.id));
    if (!user) {
      res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err: any) {
    handleAdminError(err, res);
  }
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await service.listRoles() });
  } catch (err: any) {
    handleAdminError(err, res);
  }
}

export function listPermissions(_req: Request, res: Response): void {
  res.json({ success: true, data: service.listPermissions() });
}

export function getRoleMatrix(_req: Request, res: Response): void {
  res.json({ success: true, data: service.getRoleMatrix() });
}

function handleAdminError(err: any, res: Response): void {
  res.status(500).json({
    success: false,
    code: 'ADMIN_API_ERROR',
    message: err?.message || 'Admin API failed',
  });
}
