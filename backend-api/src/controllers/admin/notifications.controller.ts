import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import AdminNotification from '../../models/AdminNotification';
import { sendSuccess, sendError } from '../../utils/response';

const PAGE_SIZE = 50;

// `before` is the createdAt of the oldest notification already loaded.
export const getNotifications = async (req: AdminRequest, res: Response): Promise<void> => {
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const filter = before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {};
  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).lean(),
    AdminNotification.countDocuments({ read: false }),
  ]);
  sendSuccess(res, {
    notifications: notifications.slice(0, PAGE_SIZE),
    hasMore: notifications.length > PAGE_SIZE,
    unreadCount,
  });
};

export const markAsRead = async (req: AdminRequest, res: Response): Promise<void> => {
  const notification = await AdminNotification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    { new: true }
  );
  if (!notification) {
    sendError(res, 'Notification not found', 404);
    return;
  }
  sendSuccess(res, notification, 'Notification marked as read');
};

export const markAllAsRead = async (_req: AdminRequest, res: Response): Promise<void> => {
  await AdminNotification.updateMany({ read: false }, { read: true });
  sendSuccess(res, null, 'All notifications marked as read');
};

export const deleteNotification = async (req: AdminRequest, res: Response): Promise<void> => {
  const notification = await AdminNotification.findByIdAndDelete(req.params.id);
  if (!notification) { sendError(res, 'Notification not found', 404); return; }
  sendSuccess(res, null, 'Notification deleted');
};

export const deleteAllNotifications = async (_req: AdminRequest, res: Response): Promise<void> => {
  await AdminNotification.deleteMany({});
  sendSuccess(res, null, 'All notifications deleted');
};
