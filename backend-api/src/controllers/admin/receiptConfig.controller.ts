import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ReceiptConfig from '../../models/ReceiptConfig';
import { generateReceiptPDF, ReceiptData } from '../../services/pdf.service';
import { getCompanyInfo } from '../../utils/receiptData';
import { diffFields, logActivity } from '../../utils/activityLog';
import { cleanSchedule, summarizeSchedule } from '../../utils/businessHours';
import { sendSuccess, sendError } from '../../utils/response';
import { BRAND_FONTS, HEX_RE, clearBrandingCache } from '../../utils/branding';
import { uploadToCloudinary } from '../../services/cloudinary.service';

const EDITABLE_FIELDS = [
  'companyName', 'addressLine1', 'addressLine2', 'phone', 'fax', 'email',
  'gstin', 'pan', 'stateName', 'stateCode', 'sacCode',
  'phone2', 'website', 'businessHours',
] as const;

export const getReceiptConfig = async (_req: AdminRequest, res: Response): Promise<void> => {
  const config = await ReceiptConfig.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
  sendSuccess(res, config);
};

export const updateReceiptConfig = async (req: AdminRequest, res: Response): Promise<void> => {
  const update: Record<string, string> = {};
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) update[field] = String(req.body[field]);
  }
  const previous = await ReceiptConfig.findOne().lean();
  const config = await ReceiptConfig.findOneAndUpdate({}, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  logActivity(req, 'update', 'Receipt Config', config.companyName, diffFields(previous, config.toObject(), Object.keys(update)));
  sendSuccess(res, config, 'Receipt settings updated');
};

/** Logo, colours, font and website. Colours must be #RRGGBB; the font comes from a fixed list. */
export const updateBranding = async (req: AdminRequest, res: Response): Promise<void> => {
  const update: Record<string, string> = {};
  const { logoUrl, brandPrimary, brandAccent, brandFont, website } = req.body || {};
  if (logoUrl !== undefined) {
    const url = String(logoUrl).trim();
    if (url && !/^https:\/\//i.test(url)) { sendError(res, 'The logo must be an https link'); return; }
    update.logoUrl = url;
  }
  for (const [key, value] of [['brandPrimary', brandPrimary], ['brandAccent', brandAccent]] as const) {
    if (value === undefined) continue;
    if (!HEX_RE.test(String(value))) { sendError(res, 'Colours must look like #0B2E3D'); return; }
    update[key] = String(value).toUpperCase();
  }
  if (brandFont !== undefined) {
    if (!BRAND_FONTS.includes(String(brandFont))) { sendError(res, 'Pick a font from the list'); return; }
    update.brandFont = String(brandFont);
  }
  if (website !== undefined) update.website = String(website).trim().slice(0, 200);
  const previous = await ReceiptConfig.findOne().lean();
  const config = await ReceiptConfig.findOneAndUpdate({}, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  clearBrandingCache();
  logActivity(req, 'update', 'Branding', 'Branding', diffFields(previous, config.toObject(), Object.keys(update)));
  sendSuccess(res, config, 'Branding saved');
};

/** Stores an uploaded logo image and returns its public link; saving it is a separate step. */
export const uploadLogo = async (req: AdminRequest, res: Response): Promise<void> => {
  if (!req.file) { sendError(res, 'No file provided'); return; }
  if (!/^image\/(png|jpe?g)$/.test(req.file.mimetype)) { sendError(res, 'The logo must be a PNG or JPG'); return; }
  const { url } = await uploadToCloudinary(req.file.buffer, 'branding', 'image');
  sendSuccess(res, { url }, 'Logo uploaded', 201);
};

// Generates a receipt from synthetic data (no real payment involved) so an admin can
// preview the printed layout, one demo covers the corporate/tax-invoice format, since
// it's the superset of what an individual receipt shows.
export const downloadDemoReceipt = async (_req: AdminRequest, res: Response): Promise<void> => {
  const company = await getCompanyInfo();

  // Subtotal: 2 × (2100 visa + 800 VFS + 1000 service) = 7800. GST is 18% of the service
  // fee only: 2 × 1000 × 0.18 = 360. Total = 8160.
  const demoData: ReceiptData = {
    payment: {
      _id: 'DEMO0000PREVIEW',
      amount: 8160,
      discountApplied: 0,
      promoCode: null,
      paidAt: new Date(),
    } as any,
    appRef: 'PRS-UNI-24817',
    userName: 'John Sample Doe',
    visaType: 'Tourist Visa',
    visaCategory: 'tourist',
    country: 'Singapore',
    receiptNumber: 'SG-1234-26-001',
    adults: 2,
    children: 0,
    adultBase: 2100,
    adultVfs: 800,
    adultFee: 1000,
    childBase: 0,
    childVfs: 0,
    childFee: 0,
    gstAmount: 360,
    accountType: 'corporate',
    clientGstin: '24ACEFA0900H1Z3',
    passportNumber: 'A1234567',
    visaNumber: 'UB812139SA11762026',
    company,
  };

  const pdfBuffer = await generateReceiptPDF(demoData);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="receipt-demo.pdf"');
  res.end(pdfBuffer);
};

/** Saves the weekly opening hours and rewrites the website's hours line from them. */
export const updateBusinessHours = async (req: AdminRequest, res: Response): Promise<void> => {
  const result = cleanSchedule(req.body?.schedule);
  if ('error' in result) { sendError(res, result.error); return; }
  const previous = await ReceiptConfig.findOne().lean();
  const businessHours = summarizeSchedule(result.schedule);
  const config = await ReceiptConfig.findOneAndUpdate({}, { $set: { hoursSchedule: result.schedule, businessHours } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  logActivity(req, 'update', 'Business Hours', businessHours, diffFields(previous, config.toObject(), ['businessHours']));
  sendSuccess(res, config, 'Business hours saved');
};
