import { Response } from 'express';
import { AdminRequest, hasAccess } from '../../middleware/adminAuth.middleware';
import AdminNotification, { AdminNotificationType } from '../../models/AdminNotification';
import type { ModuleKey } from '../../config/permissions';
import { sendSuccess, sendError } from '../../utils/response';

const PAGE_SIZE = 50;

// Which module a notification belongs to; members only see the ones they can act on.
// The admin portal applies the same map to live socket pushes.
const MODULE_OF: Record<AdminNotificationType, ModuleKey | null> = {
  new_application: 'applications',
  status_update: 'applications',
  courier_shipped: 'applications',
  new_lead: 'inquiries',
  payment_received: 'payments',
  payment_submitted: 'payments',
  payment_reminder: 'payments',
  payment_failed: 'payments',
  general: null,
};

/** Mongo filter limiting notifications to the member's modules (none for super admins). */
function visibleTo(req: AdminRequest): Record<string, unknown> {
  if (req.admin!.isSuperAdmin) return {};
  const types = (Object.keys(MODULE_OF) as AdminNotificationType[])
    .filter((t) => MODULE_OF[t] === null || hasAccess(req.admin, MODULE_OF[t]!, 'view'));
  return { type: { $in: types } };
}

// `before` is the createdAt of the oldest notification already loaded.
export const getNotifications = async (req: AdminRequest, res: Response): Promise<void> => {
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const scope = visibleTo(req);
  const filter = { ...scope, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {}) };
  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).lean(),
    AdminNotification.countDocuments({ ...scope, read: false }),
  ]);
  sendSuccess(res, {
    notifications: notifications.slice(0, PAGE_SIZE),
    hasMore: notifications.length > PAGE_SIZE,
    unreadCount,
  });
};

export const markAsRead = async (req: AdminRequest, res: Response): Promise<void> => {
  const notification = await AdminNotification.findOneAndUpdate(
    { _id: req.params.id, ...visibleTo(req) },
    { read: true },
    { new: true }
  );
  if (!notification) {
    sendError(res, 'Notification not found', 404);
    return;
  }
  sendSuccess(res, notification, 'Notification marked as read');
};

export const markAllAsRead = async (req: AdminRequest, res: Response): Promise<void> => {
  await AdminNotification.updateMany({ ...visibleTo(req), read: false }, { read: true });
  sendSuccess(res, null, 'All notifications marked as read');
};

export const deleteNotification = async (req: AdminRequest, res: Response): Promise<void> => {
  const notification = await AdminNotification.findOneAndDelete({ _id: req.params.id, ...visibleTo(req) });
  if (!notification) { sendError(res, 'Notification not found', 404); return; }
  sendSuccess(res, null, 'Notification deleted');
};

export const deleteAllNotifications = async (req: AdminRequest, res: Response): Promise<void> => {
  await AdminNotification.deleteMany(visibleTo(req));
  sendSuccess(res, null, 'All notifications deleted');
};
