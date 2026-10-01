import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin, { IAdmin, effectivePermissions } from '../models/Admin';
import { allows, moduleLabel, type AccessLevel, type ModuleKey } from '../config/permissions';
import { sendError } from '../utils/response';
import { jwtSecret } from '../config/env';

export interface AdminRequest extends Request {
  admin?: IAdmin;
}

export const adminProtect = async (req: AdminRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (!token) {
    sendError(res, 'Not authorized', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret()) as { id: string; role: string; iat: number };
    if (decoded.role !== 'admin') {
      sendError(res, 'Not authorized as admin', 403);
      return;
    }
    const admin = await Admin.findById(decoded.id).populate('role', 'name permissions');
    if (!admin || !admin.isActive || !admin.username) {
      sendError(res, 'Your account is not active. Please sign in again.', 401);
      return;
    }
    // A password reset or deactivation signs out every existing session.
    if (admin.sessionsValidFrom && decoded.iat * 1000 < admin.sessionsValidFrom.getTime() - 1000) {
      sendError(res, 'Your session has ended. Please sign in again.', 401);
      return;
    }
    req.admin = admin;
    next();
  } catch {
    sendError(res, 'Invalid token', 401);
  }
};

export const hasAccess = (admin: IAdmin | undefined, module: ModuleKey, level: AccessLevel) =>
  !!admin && (admin.isSuperAdmin || allows(effectivePermissions(admin)[module], level));

/**
 * Guards a group of routes by module. Reads (GET/HEAD) need view, anything else needs
 * manage. `readableBy` lists other modules whose holders may read this data, for pages
 * that look it up (e.g. the visa editor reading form presets).
 */
export const requireModule = (module: ModuleKey, opts: { readableBy?: ModuleKey[]; level?: AccessLevel } = {}) =>
  (req: AdminRequest, res: Response, next: NextFunction): void => {
    const level: AccessLevel = opts.level ?? (req.method === 'GET' || req.method === 'HEAD' ? 'view' : 'manage');
    const ok = hasAccess(req.admin, module, level)
      || (level === 'view' && (opts.readableBy || []).some((m) => hasAccess(req.admin, m, 'view')));
    if (ok) { next(); return; }
    sendError(res, level === 'view'
      ? `You don't have access to ${moduleLabel(module)}`
      : `You have view-only access to ${moduleLabel(module)}`, 403);
  };

export const requireSuperAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  if (req.admin?.isSuperAdmin) { next(); return; }
  sendError(res, 'Only a super admin can do this', 403);
};
