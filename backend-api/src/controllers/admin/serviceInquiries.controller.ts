import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ContactLead from '../../models/ContactLead';
import ServiceInquiry, { INQUIRY_STATUSES, InquiryStatus } from '../../models/ServiceInquiry';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';

/** Moves an inquiry or contact message along: new, open, awaiting customer, converted, closed. */
export const setInquiryStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const status = String(req.body?.status || '') as InquiryStatus;
  if (!INQUIRY_STATUSES.includes(status)) { sendError(res, 'Unknown status'); return; }
  const Model = req.params.kind === 'lead' ? ContactLead : ServiceInquiry;
  const doc = await (Model as typeof ServiceInquiry).findByIdAndUpdate(req.params.id, { $set: { status, read: true } }, { new: true });
  if (!doc) { sendError(res, 'Not found', 404); return; }
  logActivity(req, 'update', req.params.kind === 'lead' ? 'Contact Message' : 'Service Inquiry', `${doc.name}: ${status.replace('_', ' ')}`);
  sendSuccess(res, doc, 'Status updated');
};

export const getServiceInquiries = async (_req: AdminRequest, res: Response): Promise<void> => {
  const inquiries = await ServiceInquiry.find().sort({ createdAt: -1 });
  sendSuccess(res, inquiries);
};

export const markServiceInquiryRead = async (req: AdminRequest, res: Response): Promise<void> => {
  const inquiry = await ServiceInquiry.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!inquiry) { sendError(res, 'Inquiry not found', 404); return; }
  sendSuccess(res, inquiry, 'Marked as read');
};

export const deleteServiceInquiry = async (req: AdminRequest, res: Response): Promise<void> => {
  const inquiry = await ServiceInquiry.findById(req.params.id);
  if (!inquiry) { sendError(res, 'Inquiry not found', 404); return; }
  await moveToTrash('serviceInquiry', inquiry);
  sendSuccess(res, null, 'Inquiry moved to trash');
};
