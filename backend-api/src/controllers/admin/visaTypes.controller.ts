import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import VisaType from '../../models/VisaType';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';
import { logActivity } from '../../utils/activityLog';
import { normalizeFormItems } from '../../utils/formItems';

export const getVisaTypes = async (req: AdminRequest, res: Response): Promise<void> => {
  const filter = req.query.country ? { country: req.query.country } : {};
  const visaTypes = await VisaType.find(filter).populate('country', 'name flag').sort({ order: 1, name: 1 });
  sendSuccess(res, visaTypes);
};

/**
 * Persists the admin's drag-arranged sequence. The client sends the full list of ids
 * for one country in display order; position in that array becomes `order`.
 */
export const reorderVisaTypes = async (req: AdminRequest, res: Response): Promise<void> => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) { sendError(res, 'ids must be a non-empty array'); return; }
  await VisaType.bulkWrite(
    ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } }))
  );
  logActivity(req, 'update', 'Visa Type', `Reordered ${ids.length} visa types`);
  sendSuccess(res, null, 'Order saved');
};

export const getVisaType = async (req: AdminRequest, res: Response): Promise<void> => {
  const visaType = await VisaType.findById(req.params.id).populate('country', 'name flag');
  if (!visaType) { sendError(res, 'Visa type not found', 404); return; }
  sendSuccess(res, visaType);
};

const optNum = (v: unknown): number | undefined =>
  v === undefined || v === null || v === '' ? undefined : Number(v);

// Optional overrides: blank means "use the standard price", 0 is a real (waived) price.
const OPTIONAL_PRICE_FIELDS = [
  'corporateAdultServiceFee', 'corporateChildServiceFee',
  'b2bAdultPrice', 'b2bChildPrice', 'b2bAdultVfsFee', 'b2bChildVfsFee', 'b2bAdultServiceFee', 'b2bChildServiceFee',
] as const;

export const createVisaType = async (req: AdminRequest, res: Response): Promise<void> => {
  const {
    country, name, description, adultPrice, childPrice, adultVfsFee, childVfsFee, adultServiceFee, childServiceFee,
    processingTime, terms, entry, visaSubType, stayDuration,
    jurisdiction, visaCategory, process, validity, additionalNotes,
  } = req.body;
  const { formFields, documentRequirements } = normalizeFormItems(req.body);
  if (!country || !name || adultPrice === undefined || !processingTime) {
    sendError(res, 'Country, name, adult price, and processingTime are required');
    return;
  }
  // `price` mirrors the per-adult base rate for backward compatibility (listing "from" price).
  const price = Number(adultPrice);
  // New visas land at the end of the country's list rather than jumping into the middle.
  // The count covers records saved before `order` existed (the field is simply absent,
  // so the max is undefined); the max covers gaps left behind by deletions.
  const [last, count] = await Promise.all([
    VisaType.findOne({ country }).sort({ order: -1 }).select('order').lean(),
    VisaType.countDocuments({ country }),
  ]);
  const visaType = await VisaType.create({
    country, name, description,
    price,
    order: Math.max((last?.order ?? -1) + 1, count),
    adultPrice: Number(adultPrice),
    childPrice: Number(childPrice || 0),
    adultVfsFee: Number(adultVfsFee || 0),
    childVfsFee: Number(childVfsFee || 0),
    adultServiceFee: Number(adultServiceFee || 0),
    childServiceFee: Number(childServiceFee || 0),
    ...Object.fromEntries(OPTIONAL_PRICE_FIELDS.map((f) => [f, optNum(req.body[f])])),
    processingTime, formFields, documentRequirements, entry, visaSubType, stayDuration,
    terms: (terms || []).map((t: any, i: number) => ({ ...t, order: i })),
    jurisdiction, visaCategory, process, validity, additionalNotes: additionalNotes || '',
  });
  const populated = await VisaType.findById(visaType._id).populate('country', 'name flag');
  logActivity(req, 'create', 'Visa Type', name);
  sendSuccess(res, populated, 'Visa type created', 201);
};

export const updateVisaType = async (req: AdminRequest, res: Response): Promise<void> => {
  const body = normalizeFormItems({ ...req.body });
  // Keep legacy `price` mirrored to the per-adult base rate.
  if (body.adultPrice !== undefined) {
    body.adultPrice = Number(body.adultPrice);
    body.price = body.adultPrice;
  }
  if (body.childPrice !== undefined) body.childPrice = Number(body.childPrice);
  if (body.adultVfsFee !== undefined) body.adultVfsFee = Number(body.adultVfsFee || 0);
  if (body.childVfsFee !== undefined) body.childVfsFee = Number(body.childVfsFee || 0);
  if (body.adultServiceFee !== undefined) body.adultServiceFee = Number(body.adultServiceFee || 0);
  if (body.childServiceFee !== undefined) body.childServiceFee = Number(body.childServiceFee || 0);
  // Blanking an override must remove it, not leave the old value in place. Mongoose skips
  // `undefined` in an update, so clearing needs an explicit $unset.
  const unset: Record<string, ''> = {};
  for (const field of OPTIONAL_PRICE_FIELDS) {
    if (body[field] === undefined) continue;
    const value = optNum(body[field]);
    if (value === undefined) { delete body[field]; unset[field] = ''; } else { body[field] = value; }
  }
  if (Array.isArray(body.terms)) body.terms = body.terms.map((t: any, i: number) => ({ ...t, order: i }));
  const update = Object.keys(unset).length ? { $set: body, $unset: unset } : body;
  const visaType = await VisaType.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
    .populate('country', 'name flag');
  if (!visaType) { sendError(res, 'Visa type not found', 404); return; }
  logActivity(req, 'update', 'Visa Type', visaType.name);
  sendSuccess(res, visaType, 'Visa type updated');
};

export const deleteVisaType = async (req: AdminRequest, res: Response): Promise<void> => {
  const visaType = await VisaType.findById(req.params.id);
  if (!visaType) { sendError(res, 'Visa type not found', 404); return; }
  await moveToTrash('visaType', visaType);
  logActivity(req, 'delete', 'Visa Type', visaType.name);
  sendSuccess(res, null, 'Visa type moved to trash');
};

export const toggleVisaTypeStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const visaType = await VisaType.findById(req.params.id).populate('country', 'name flag');
  if (!visaType) { sendError(res, 'Visa type not found', 404); return; }
  visaType.isActive = !visaType.isActive;
  await visaType.save();
  sendSuccess(res, visaType, `Visa type ${visaType.isActive ? 'activated' : 'deactivated'}`);
};
