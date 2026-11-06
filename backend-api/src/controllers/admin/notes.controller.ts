import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Admin from '../../models/Admin';
import AdminNotification from '../../models/AdminNotification';
import Application from '../../models/Application';
import ApplicationNote from '../../models/ApplicationNote';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

/** Internal notes on an application, newest first. */
export const getNotes = async (req: AdminRequest, res: Response): Promise<void> => {
  const notes = await ApplicationNote.find({ application: req.params.id }).sort({ createdAt: -1 }).limit(200)
    .populate('mentions', 'name').lean();
  sendSuccess(res, notes);
};

/**
 * Adds a note. Each @mentioned member (active, not the author) gets a notification only
 * they can see, pushed live to their open console.
 */
export const addNote = async (req: AdminRequest, res: Response): Promise<void> => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) { sendError(res, 'Write a note first'); return; }
  if (text.length > 2000) { sendError(res, 'Notes can be up to 2000 characters'); return; }
  const app = await Application.findById(req.params.id).select('referenceId');
  if (!app) { sendError(res, 'Application not found', 404); return; }

  const ids = (Array.isArray(req.body?.mentions) ? req.body.mentions : []).map(String).filter((id: string) => /^[a-f0-9]{24}$/i.test(id));
  const mentioned = await Admin.find({ _id: { $in: ids, $ne: req.admin!._id }, isActive: true }).select('name');

  const note = await ApplicationNote.create({
    application: app._id, admin: req.admin!._id, adminName: req.admin!.name, text, mentions: mentioned.map((m) => m._id),
  });
  logActivity(req, 'create', 'Application Note', `${app.referenceId}: note${mentioned.length ? ` mentioning ${mentioned.map((m) => m.name).join(', ')}` : ''}`);

  for (const m of mentioned) {
    const notif = await AdminNotification.create({
      title: `${req.admin!.name} mentioned you`,
      message: `${app.referenceId}: ${text.slice(0, 160)}`,
      type: 'mention',
      application: app._id,
      recipient: m._id,
    });
    try {
      const { getIO } = await import('../../utils/socket');
      getIO().to('admin_room').emit('admin_notification', notif);
    } catch (err) {
      console.error('Socket emission failed', err);
    }
  }
  sendSuccess(res, await note.populate('mentions', 'name'), mentioned.length ? `Note added; ${mentioned.length} notified` : 'Note added', 201);
};
