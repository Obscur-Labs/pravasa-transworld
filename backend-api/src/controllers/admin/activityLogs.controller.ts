import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ActivityLog, { LOG_RETENTION_DAYS } from '../../models/ActivityLog';
import { sendSuccess } from '../../utils/response';

export const getActivityLogs = async (_req: AdminRequest, res: Response): Promise<void> => {
  const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(1000).lean();
  sendSuccess(res, { logs, retentionDays: LOG_RETENTION_DAYS });
};

export const deleteAllActivityLogs = async (_req: AdminRequest, res: Response): Promise<void> => {
  await ActivityLog.deleteMany({});
  sendSuccess(res, null, 'Activity logs cleared');
};
