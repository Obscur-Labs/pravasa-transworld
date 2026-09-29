import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { sendError } from '../utils/response';
import { jwtSecret } from '../config/env';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (!token) {
    sendError(res, 'Not authorized', 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret()) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      sendError(res, 'User not found or inactive', 401);
      return;
    }
    req.user = user;
    next();
  } catch {
    sendError(res, 'Invalid token', 401);
  }
};

// Like `protect`, but never blocks the request — used on public endpoints that adjust
// their response (e.g. corporate pricing) when the caller happens to be logged in.
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret()) as { id: string };
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    } catch {
      // Anonymous request — ignore invalid/expired tokens instead of blocking.
    }
  }
  next();
};
