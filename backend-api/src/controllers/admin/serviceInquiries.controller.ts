import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ServiceInquiry from '../../models/ServiceInquiry';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';

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
