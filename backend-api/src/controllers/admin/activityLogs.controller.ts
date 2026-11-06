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
function logFilter(req: AdminRequest): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const { admin, module, action, search } = req.query;
  if (typeof admin === 'string' && mongoose.isValidObjectId(admin)) filter.admin = admin;
  if (typeof module === 'string' && /^[a-zA-Z]{1,40}$/.test(module)) filter.module = module;
  if (action === 'create' || action === 'update' || action === 'delete') filter.action = action;
  const term = String(search ?? '').trim().slice(0, 80);
  if (term) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ entityLabel: pattern }, { entityType: pattern }, { adminName: pattern }];
  }
  return filter;
}

export const getActivityLogs = async (req: AdminRequest, res: Response): Promise<void> => {
  const filter = logFilter(req);

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

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The filtered log as CSV, times in IST. Logs can be exported but never deleted. */
export const exportActivityLogsCsv = async (req: AdminRequest, res: Response): Promise<void> => {
  const logs = await ActivityLog.find(logFilter(req)).sort({ createdAt: -1 }).limit(10000).lean();
  const ist = (d: Date) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const rows = [
    ['Time (IST)', 'Member', 'Action', 'Module', 'Type', 'Record', 'Changes'],
    ...logs.map((l) => [ist(l.createdAt), l.adminName, l.action, l.module, l.entityType, l.entityLabel,
      (l.changes || []).map((c) => `${c.field}: ${c.from || '(empty)'} -> ${c.to || '(empty)'}`).join('; ')]),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.end(`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`);
};
