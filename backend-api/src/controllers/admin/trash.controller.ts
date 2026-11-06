import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Trash from '../../models/Trash';
import Document from '../../models/Document';
import Payment from '../../models/Payment';
import VisaFile from '../../models/VisaFile';
import Notification from '../../models/Notification';
import { TRASH_MODELS, ENTITY_LABELS } from '../../utils/trash';
import { sendSuccess, sendError } from '../../utils/response';
import { logActivity } from '../../utils/activityLog';

// When an application is permanently removed, purge its dependent records too.
async function purgeApplicationRelated(appId: unknown) {
  await Promise.all([
    Document.deleteMany({ application: appId }),
    Payment.deleteMany({ application: appId }),
    VisaFile.deleteMany({ application: appId }),
    Notification.deleteMany({ application: appId }),
  ]);
}

export const TRASH_RETENTION_DAYS = 30;
const DAY = 86400000;

/** Removes items past the retention window (with their application records). */
async function purgeExpired() {
  const expired = await Trash.find({ deletedAt: { $lt: new Date(Date.now() - TRASH_RETENTION_DAYS * DAY) } });
  for (const i of expired) {
    if (i.entityType === 'application') await purgeApplicationRelated(i.originalId);
    await i.deleteOne();
  }
}

export const getTrash = async (_req: AdminRequest, res: Response): Promise<void> => {
  await purgeExpired();
  const items = await Trash.find().sort({ deletedAt: -1 });
  const withType = items.map((i) => ({
    _id: i._id,
    entityType: i.entityType,
    entityLabel: ENTITY_LABELS[i.entityType] || i.entityType,
    label: i.label,
    sublabel: i.sublabel,
    originalId: i.originalId,
    deletedAt: i.deletedAt,
    daysLeft: Math.max(0, Math.ceil((new Date(i.deletedAt).getTime() + TRASH_RETENTION_DAYS * DAY - Date.now()) / DAY)),
  }));
  sendSuccess(res, { items: withType, retentionDays: TRASH_RETENTION_DAYS });
};

export const restoreTrashItem = async (req: AdminRequest, res: Response): Promise<void> => {
  const item = await Trash.findById(req.params.id);
  if (!item) { sendError(res, 'Trash item not found', 404); return; }

  const Model = TRASH_MODELS[item.entityType];
  if (!Model) { sendError(res, 'Cannot restore this item type'); return; }

  // Re-insert the original document exactly as it was (preserving _id and timestamps).
  const existing = await Model.findById(item.originalId);
  if (existing) {
    // Original id is somehow back already, just drop the trash record.
    await item.deleteOne();
    sendSuccess(res, null, 'Item already exists; removed from trash');
    return;
  }

  try {
    await Model.collection.insertOne(item.data as any);
  } catch (err: any) {
    sendError(res, err?.code === 11000 ? 'Cannot restore: a conflicting record already exists' : 'Failed to restore item');
    return;
  }
  await item.deleteOne();
  sendSuccess(res, null, 'Item restored');
};

export const deleteTrashItem = async (req: AdminRequest, res: Response): Promise<void> => {
  const item = await Trash.findById(req.params.id);
  if (!item) { sendError(res, 'Trash item not found', 404); return; }
  // The member types the item's name to confirm, so a slip of the mouse can't destroy it.
  if (String(req.body?.confirm ?? '').trim() !== item.label.trim()) {
    sendError(res, `Type "${item.label}" to confirm`); return;
  }
  if (item.entityType === 'application') await purgeApplicationRelated(item.originalId);
  await item.deleteOne();
  logActivity(req, 'delete', 'Trash', `Permanently deleted ${item.label}`);
  sendSuccess(res, null, 'Item permanently deleted');
};

export const emptyTrash = async (req: AdminRequest, res: Response): Promise<void> => {
  if (String(req.body?.confirm ?? '') !== 'EMPTY TRASH') { sendError(res, 'Type EMPTY TRASH to confirm'); return; }
  logActivity(req, 'delete', 'Trash', 'Emptied the trash');
  const appItems = await Trash.find({ entityType: 'application' });
  await Promise.all(appItems.map((i) => purgeApplicationRelated(i.originalId)));
  await Trash.deleteMany({});
  sendSuccess(res, null, 'Trash emptied');
};
