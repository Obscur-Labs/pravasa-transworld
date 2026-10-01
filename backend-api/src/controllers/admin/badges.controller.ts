import { Response } from 'express';
import { AdminRequest, hasAccess } from '../../middleware/adminAuth.middleware';
import Payment from '../../models/Payment';
import ContactLead from '../../models/ContactLead';
import ServiceInquiry from '../../models/ServiceInquiry';
import { sendSuccess } from '../../utils/response';

/** Sidebar counts, only for the modules this member can see. */
export const getBadges = async (req: AdminRequest, res: Response): Promise<void> => {
  const counts: { payments?: number; inquiries?: number } = {};
  await Promise.all([
    hasAccess(req.admin, 'payments', 'view') && Payment.countDocuments({ status: 'awaiting_verification' }).then((n) => { counts.payments = n; }),
    hasAccess(req.admin, 'inquiries', 'view') && Promise.all([
      ContactLead.countDocuments({ read: false }),
      ServiceInquiry.countDocuments({ read: false }),
    ]).then(([a, b]) => { counts.inquiries = a + b; }),
  ]);
  sendSuccess(res, counts);
};
