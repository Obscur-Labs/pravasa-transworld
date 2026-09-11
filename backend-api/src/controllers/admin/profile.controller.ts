import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ActivityLog from '../../models/ActivityLog';
import { toAdminProfile } from '../../models/Admin';
import { sendSuccess, sendError } from '../../utils/response';

export const getProfile = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = req.admin!;
  const recentActivity = await ActivityLog.find({ admin: admin._id }).sort({ createdAt: -1 }).limit(10).lean();
  sendSuccess(res, { profile: toAdminProfile(admin), recentActivity });
};

export const updateProfile = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = req.admin!;
  const name = String(req.body?.name ?? '').trim();
  const phone = String(req.body?.phone ?? '').trim();

  if (!name) { sendError(res, 'Name is required'); return; }
  if (!/^\+?[\d\s()-]{7,20}$/.test(phone)) { sendError(res, 'Enter a valid phone number'); return; }

  admin.name = name;
  admin.phone = phone;
  await admin.save();
  sendSuccess(res, { profile: toAdminProfile(admin) }, 'Profile updated');
};
