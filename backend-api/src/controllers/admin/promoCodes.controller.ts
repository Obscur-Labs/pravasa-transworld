import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import PromoCode from '../../models/PromoCode';
import { sendSuccess, sendError } from '../../utils/response';
import { logActivity } from '../../utils/activityLog';

// Only one promo code may be shown on the website at a time, turning one on
// silently turns every other one off.
const enforceSingleWebsitePromo = async (exceptId: unknown): Promise<void> => {
  await PromoCode.updateMany({ _id: { $ne: exceptId }, showOnWebsite: true }, { showOnWebsite: false });
};

export const getPromoCodes = async (req: AdminRequest, res: Response): Promise<void> => {
  const promos = await PromoCode.find({ isDeleted: false }).sort({ createdAt: -1 }).select('-usedBy');
  sendSuccess(res, promos);
};

export const createPromoCode = async (req: AdminRequest, res: Response): Promise<void> => {
  const { code, description, discountType, discountValue, isActive, showOnWebsite, expiresAt, usageLimit } = req.body;
  if (!code || !discountType || discountValue === undefined) {
    sendError(res, 'code, discountType, and discountValue are required', 400);
    return;
  }
  const upper = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!upper) { sendError(res, 'Code must contain alphanumeric characters', 400); return; }

  const exists = await PromoCode.findOne({ code: upper, isDeleted: false });
  if (exists) { sendError(res, 'A promo code with this code already exists', 409); return; }

  const promo = await PromoCode.create({
    code: upper,
    description: description || '',
    discountType,
    discountValue: Number(discountValue),
    isActive: isActive !== false,
    showOnWebsite: showOnWebsite === true,
    expiresAt: expiresAt || undefined,
    usageLimit: usageLimit ? Number(usageLimit) : undefined,
  });
  if (promo.showOnWebsite) await enforceSingleWebsitePromo(promo._id);
  logActivity(req, 'create', 'Promo Code', upper);
  sendSuccess(res, promo, 'Promo code created', 201);
};

export const updatePromoCode = async (req: AdminRequest, res: Response): Promise<void> => {
  const { code, description, discountType, discountValue, isActive, showOnWebsite, expiresAt, usageLimit } = req.body;
  const promo = await PromoCode.findOne({ _id: req.params.id, isDeleted: false });
  if (!promo) { sendError(res, 'Promo code not found', 404); return; }

  if (code !== undefined) {
    const upper = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!upper) { sendError(res, 'Code must contain alphanumeric characters', 400); return; }
    const dup = await PromoCode.findOne({ code: upper, isDeleted: false, _id: { $ne: promo._id } });
    if (dup) { sendError(res, 'A promo code with this code already exists', 409); return; }
    promo.code = upper;
  }
  if (description !== undefined) promo.description = description;
  if (discountType !== undefined) promo.discountType = discountType;
  if (discountValue !== undefined) promo.discountValue = Number(discountValue);
  if (isActive !== undefined) promo.isActive = isActive;
  if (showOnWebsite !== undefined) promo.showOnWebsite = showOnWebsite;
  promo.expiresAt = expiresAt || undefined;
  promo.usageLimit = usageLimit ? Number(usageLimit) : undefined;

  await promo.save();
  if (promo.showOnWebsite) await enforceSingleWebsitePromo(promo._id);
  logActivity(req, 'update', 'Promo Code', promo.code);
  sendSuccess(res, promo);
};

export const togglePromoActive = async (req: AdminRequest, res: Response): Promise<void> => {
  const promo = await PromoCode.findOne({ _id: req.params.id, isDeleted: false });
  if (!promo) { sendError(res, 'Promo code not found', 404); return; }
  promo.isActive = !promo.isActive;
  await promo.save();
  sendSuccess(res, promo);
};

export const togglePromoWebsite = async (req: AdminRequest, res: Response): Promise<void> => {
  const promo = await PromoCode.findOne({ _id: req.params.id, isDeleted: false });
  if (!promo) { sendError(res, 'Promo code not found', 404); return; }
  promo.showOnWebsite = !promo.showOnWebsite;
  await promo.save();
  if (promo.showOnWebsite) await enforceSingleWebsitePromo(promo._id);
  sendSuccess(res, promo);
};

export const deletePromoCode = async (req: AdminRequest, res: Response): Promise<void> => {
  const promo = await PromoCode.findOne({ _id: req.params.id, isDeleted: false });
  if (!promo) { sendError(res, 'Promo code not found', 404); return; }
  promo.isDeleted = true;
  promo.deletedAt = new Date();
  await promo.save();
  logActivity(req, 'delete', 'Promo Code', promo.code);
  sendSuccess(res, null, 'Promo code deleted');
};

export const getPromoHistory = async (req: AdminRequest, res: Response): Promise<void> => {
  const promo = await PromoCode.findOne({ _id: req.params.id, isDeleted: false });
  if (!promo) { sendError(res, 'Promo code not found', 404); return; }
  sendSuccess(res, {
    code: promo.code,
    usageCount: promo.usageCount,
    usageLimit: promo.usageLimit,
    usedBy: [...promo.usedBy].sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()),
  });
};
