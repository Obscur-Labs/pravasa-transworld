import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import VisaConfigOption, { VisaConfigCategory } from '../../models/VisaConfigOption';
import VisaType from '../../models/VisaType';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

const CATEGORIES: VisaConfigCategory[] = ['jurisdiction', 'visaCategory', 'visaSubType', 'entryType'];

// Maps a config category to the VisaType field(s) that store its value, so a delete
// can be blocked if any visa type is still using the option.
const REFERENCING_FIELD: Record<VisaConfigCategory, string> = {
  jurisdiction: 'jurisdiction',
  visaCategory: 'visaCategory',
  visaSubType: 'visaSubType',
  entryType: 'entry',
};

const slugify = (text: string): string =>
  text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const getVisaConfigOptions = async (_req: AdminRequest, res: Response): Promise<void> => {
  const options = await VisaConfigOption.find().sort({ category: 1, order: 1, label: 1 });
  sendSuccess(res, options);
};

export const createVisaConfigOption = async (req: AdminRequest, res: Response): Promise<void> => {
  const { category, label, order } = req.body;
  let { value } = req.body;

  if (!category || !CATEGORIES.includes(category)) {
    sendError(res, `category must be one of: ${CATEGORIES.join(', ')}`, 400);
    return;
  }
  if (!label || !String(label).trim()) {
    sendError(res, 'Label is required', 400);
    return;
  }
  value = value ? slugify(String(value)) : slugify(String(label));
  if (!value) {
    sendError(res, 'Could not derive a valid value from the label', 400);
    return;
  }

  const exists = await VisaConfigOption.findOne({ category, value });
  if (exists) {
    sendError(res, `An option with value "${value}" already exists in this category`, 409);
    return;
  }

  const option = await VisaConfigOption.create({
    category,
    value,
    label: String(label).trim(),
    order: order ?? 0,
  });
  logActivity(req, 'create', 'Visa Config', `${category}: ${option.label}`);
  sendSuccess(res, option, 'Option created', 201);
};

export const updateVisaConfigOption = async (req: AdminRequest, res: Response): Promise<void> => {
  const { label, order, isActive } = req.body;
  const option = await VisaConfigOption.findById(req.params.id);
  if (!option) { sendError(res, 'Option not found', 404); return; }

  // `category` and `value` are intentionally not editable here, existing VisaType
  // documents reference `value` by string, so changing it would silently orphan them.
  if (label !== undefined) option.label = String(label).trim();
  if (order !== undefined) option.order = Number(order);
  if (isActive !== undefined) option.isActive = !!isActive;

  await option.save();
  logActivity(req, 'update', 'Visa Config', `${option.category}: ${option.label}`);
  sendSuccess(res, option, 'Option updated');
};

export const deleteVisaConfigOption = async (req: AdminRequest, res: Response): Promise<void> => {
  const option = await VisaConfigOption.findById(req.params.id);
  if (!option) { sendError(res, 'Option not found', 404); return; }

  const field = REFERENCING_FIELD[option.category];
  const inUse = await VisaType.exists({ [field]: option.value });
  if (inUse) {
    sendError(res, 'This option is used by one or more visa types. Deactivate it instead of deleting.', 409);
    return;
  }

  await option.deleteOne();
  logActivity(req, 'delete', 'Visa Config', `${option.category}: ${option.label}`);
  sendSuccess(res, null, 'Option deleted');
};
