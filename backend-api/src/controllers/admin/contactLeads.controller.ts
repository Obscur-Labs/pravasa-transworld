import { Request, Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ContactLead from '../../models/ContactLead';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';

export const submitContactLead = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    sendError(res, 'Name, email, and message are required');
    return;
  }
  const lead = await ContactLead.create({ name, email, phone, message });

  const AdminNotification = (await import('../../models/AdminNotification')).default;
  const { getIO } = await import('../../utils/socket');
  
  const notif = await AdminNotification.create({
    title: 'New Lead Submission',
    message: `${name} has submitted a new contact request.`,
    type: 'new_lead',
  });

  try {
    getIO().to('admin_room').emit('admin_notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  sendSuccess(res, lead, 'Message sent successfully', 201);
};

export const getLeads = async (_req: AdminRequest, res: Response): Promise<void> => {
  const leads = await ContactLead.find().sort({ createdAt: -1 });
  sendSuccess(res, leads);
};

export const markLeadRead = async (req: AdminRequest, res: Response): Promise<void> => {
  const lead = await ContactLead.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!lead) { sendError(res, 'Lead not found', 404); return; }
  sendSuccess(res, lead, 'Lead marked as read');
};

export const deleteLead = async (req: AdminRequest, res: Response): Promise<void> => {
  const lead = await ContactLead.findById(req.params.id);
  if (!lead) { sendError(res, 'Lead not found', 404); return; }
  await moveToTrash('contactLead', lead);
  sendSuccess(res, null, 'Lead moved to trash');
};
