import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ActivityLog from '../../models/ActivityLog';
import AdminLoginEvent from '../../models/AdminLoginEvent';
import Admin, { toAdminProfile } from '../../models/Admin';
import { signToken } from '../auth.controller';
import { hashPassword, passwordProblem, verifyPassword } from '../../utils/password';
import { sendSuccess, sendError } from '../../utils/response';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getProfile = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = req.admin!;
  const [recentActivity, recentSignIns] = await Promise.all([
    ActivityLog.find({ admin: admin._id }).sort({ createdAt: -1 }).limit(10).lean(),
    // Lets members spot sign-ins or failed attempts that weren't them.
    AdminLoginEvent.find({ admin: admin._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  sendSuccess(res, { profile: toAdminProfile(admin), recentActivity, recentSignIns });
};

export const updateProfile = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = req.admin!;
  const name = String(req.body?.name ?? '').trim();
  const phone = String(req.body?.phone ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  if (!name) { sendError(res, 'Name is required'); return; }
  if (!/^\+?[\d\s()-]{7,20}$/.test(phone)) { sendError(res, 'Enter a valid phone number'); return; }
  if (email && !EMAIL_RE.test(email)) { sendError(res, 'That email address does not look right'); return; }

  admin.name = name;
  admin.phone = phone;
  admin.set('email', email || undefined);
  try {
    await admin.save();
  } catch (err: any) {
    if (err?.code === 11000) { sendError(res, 'Another team member already uses this email', 409); return; }
    throw err;
  }
  sendSuccess(res, { profile: toAdminProfile(admin) }, 'Profile updated');
};

/** Changes your own password. Other sessions are signed out; this one gets a fresh token. */
export const changePassword = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = await Admin.findById(req.admin!._id).select('+passwordHash');
  if (!admin) { sendError(res, 'Account not found', 404); return; }
  const current = String(req.body?.currentPassword ?? '');
  const next = String(req.body?.newPassword ?? '');

  if (!(await verifyPassword(current, admin.passwordHash))) { sendError(res, 'Your current password is incorrect'); return; }
  const problem = passwordProblem(next);
  if (problem) { sendError(res, problem); return; }
  if (current === next) { sendError(res, 'Choose a password different from the current one'); return; }

  admin.passwordHash = await hashPassword(next);
  admin.sessionsValidFrom = new Date();
  admin.mustChangePassword = false;
  await admin.save();
  sendSuccess(res, { token: signToken(String(admin._id), 'admin') }, 'Password changed');
};
