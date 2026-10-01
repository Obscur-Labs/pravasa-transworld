import { Response } from 'express';
import mongoose from 'mongoose';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ActivityLog, { logRetentionDays } from '../../models/ActivityLog';
import { sendSuccess } from '../../utils/response';

const MAX_RESULTS = 2000;

/**
 * Newest first, filtered by member (admin id), module and action. Also returns who has
 * entries and which modules appear, to fill the filter dropdowns.
 */
export const getActivityLogs = async (req: AdminRequest, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = {};
  const { admin, module, action } = req.query;
  if (typeof admin === 'string' && mongoose.isValidObjectId(admin)) filter.admin = admin;
  if (typeof module === 'string' && /^[a-zA-Z]{1,40}$/.test(module)) filter.module = module;
  if (action === 'create' || action === 'update' || action === 'delete') filter.action = action;

  const [logs, total, members, modules] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).limit(MAX_RESULTS).lean(),
    ActivityLog.countDocuments(filter),
    ActivityLog.aggregate([
      { $match: { admin: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$admin', name: { $first: '$adminName' } } },
      { $sort: { name: 1 } },
    ]),
    ActivityLog.distinct('module', { module: { $ne: '' } }),
  ]);
  sendSuccess(res, { logs, total, limit: MAX_RESULTS, retentionDays: logRetentionDays(), members, modules });
};

export const deleteAllActivityLogs = async (_req: AdminRequest, res: Response): Promise<void> => {
  await ActivityLog.deleteMany({});
  sendSuccess(res, null, 'Activity logs cleared');
};
