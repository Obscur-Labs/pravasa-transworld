import { Request, Response } from 'express';
import ReceiptConfig, { IReceiptConfig } from '../../models/ReceiptConfig';
import { sendSuccess } from '../../utils/response';

// Used until the admin fills Configurations > Receipt; matches the client's handoff.
const DEFAULTS = {
  companyName: 'Pravasa Transworld Pvt Ltd',
  address: 'Office 228, Royal Square, VIP Cir to Utran Rd, Utran, Surat, Gujarat - 394105',
  phones: ['+91 84695 24000', '+91 84693 24000'],
  email: 'support.pravasatransworld@gmail.com',
  website: 'www.pravasatransworld.com',
  businessHours: 'Mon–Sat 10 AM – 7 PM IST',
};

/** Public contact details shown in the website header, footer, contact, privacy and terms pages. */
export const getBusinessInfo = async (_req: Request, res: Response): Promise<void> => {
  const c = await ReceiptConfig.findOne().lean<IReceiptConfig>();
  const address = [c?.addressLine1, c?.addressLine2].map((l) => (l || '').trim()).filter(Boolean).join(', ');
  const phones = [c?.phone, c?.phone2].map((p) => (p || '').trim()).filter(Boolean);
  res.set('Cache-Control', 'public, max-age=300');
  sendSuccess(res, {
    companyName: c?.companyName?.trim() || DEFAULTS.companyName,
    address: address || DEFAULTS.address,
    phones: phones.length ? phones : DEFAULTS.phones,
    email: c?.email?.trim() || DEFAULTS.email,
    website: c?.website?.trim() || DEFAULTS.website,
    businessHours: c?.businessHours?.trim() || DEFAULTS.businessHours,
  });
};
