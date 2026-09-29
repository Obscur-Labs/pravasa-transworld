import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin, { IAdmin } from '../models/Admin';
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
    const decoded = jwt.verify(token, jwtSecret()) as { id: string; role: string };
    if (decoded.role !== 'admin') {
      sendError(res, 'Not authorized as admin', 403);
      return;
    }
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      sendError(res, 'Admin not found', 401);
      return;
    }
    req.admin = admin;
    next();
  } catch {
    sendError(res, 'Invalid token', 401);
  }
};
