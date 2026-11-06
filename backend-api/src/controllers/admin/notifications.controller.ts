import { Response } from 'express';
import { AdminRequest, hasAccess } from '../../middleware/adminAuth.middleware';
import AdminNotification, { AdminNotificationType } from '../../models/AdminNotification';
import type { ModuleKey } from '../../config/permissions';
import { sendSuccess, sendError } from '../../utils/response';
import Admin from '../../models/Admin';

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
  mention: null,
  general: null,
};

// Categories a member can mute in their notification preferences. Mentions can't be muted.
export const MUTABLE_CATEGORIES: Record<string, AdminNotificationType[]> = {
  applications: ['new_application', 'status_update', 'courier_shipped'],
  payments: ['payment_received', 'payment_submitted', 'payment_reminder', 'payment_failed'],
  inquiries: ['new_lead'],
  general: ['general'],
};

/**
 * Notifications this member sees: the modules they can open, minus muted categories,
 * and of the @mentions only their own.
 */
function visibleTo(req: AdminRequest): Record<string, unknown> {
  const muted = new Set((req.admin!.mutedNotifications || []).flatMap((c) => MUTABLE_CATEGORIES[c] || []));
  const types = (Object.keys(MODULE_OF) as AdminNotificationType[])
    .filter((t) => req.admin!.isSuperAdmin || MODULE_OF[t] === null || hasAccess(req.admin, MODULE_OF[t]!, 'view'))
    .filter((t) => !muted.has(t));
  return { type: { $in: types }, $or: [{ recipient: null }, { recipient: req.admin!._id }] };
}

// `before` is the createdAt of the oldest notification already loaded.
// ?tab=unread|mentions|payments narrows the list; the unread count is always the full one.
const TAB_FILTERS: Record<string, Record<string, unknown>> = {
  unread: { read: false },
  mentions: { type: 'mention' },
  payments: { type: { $in: MUTABLE_CATEGORIES.payments } },
};

export const getNotifications = async (req: AdminRequest, res: Response): Promise<void> => {
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const scope = visibleTo(req);
  const tab = TAB_FILTERS[String(req.query.tab)] || {};
  const filter = {
    $and: [scope, tab, before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {}],
  };
  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).populate('application', 'referenceId').lean(),
    AdminNotification.countDocuments({ ...scope, read: false }),
  ]);
  // The application stays an id for links; its number rides along for grouping headers.
  const shaped = notifications.slice(0, PAGE_SIZE).map((n) => {
    const app = n.application as unknown as { _id: unknown; referenceId?: string } | null;
    return { ...n, application: app?._id ?? null, applicationRef: app?.referenceId ?? '' };
  });
  sendSuccess(res, {
    notifications: shaped,
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

export const getNotificationPreferences = async (req: AdminRequest, res: Response): Promise<void> => {
  sendSuccess(res, { categories: Object.keys(MUTABLE_CATEGORIES), muted: req.admin!.mutedNotifications || [] });
};

export const updateNotificationPreferences = async (req: AdminRequest, res: Response): Promise<void> => {
  const muted = (Array.isArray(req.body?.muted) ? req.body.muted : []).filter((c: unknown) => typeof c === 'string' && c in MUTABLE_CATEGORIES);
  await Admin.updateOne({ _id: req.admin!._id }, { $set: { mutedNotifications: muted } });
  sendSuccess(res, { muted }, 'Preferences saved');
};
