import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Country from '../../models/Country';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';
import { diffFields, logActivity } from '../../utils/activityLog';
import { uploadToCloudinary, deleteFromCloudinary } from '../../services/cloudinary.service';

export const getCountries = async (_req: AdminRequest, res: Response): Promise<void> => {
  const countries = await Country.find().sort({ name: 1 });
  sendSuccess(res, countries);
};

export const getCountry = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  sendSuccess(res, country);
};

export const createCountry = async (req: AdminRequest, res: Response): Promise<void> => {
  const { name, flag, description } = req.body;
  if (!name || !flag) {
    sendError(res, 'Name and flag are required');
    return;
  }
  const country = await Country.create({ name, flag, description });
  logActivity(req, 'create', 'Country', name);
  sendSuccess(res, country, 'Country created', 201);
};

export const updateCountry = async (req: AdminRequest, res: Response): Promise<void> => {
  const previous = await Country.findById(req.params.id).lean();
  const country = await Country.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!country) { sendError(res, 'Country not found', 404); return; }
  logActivity(req, 'update', 'Country', country.name, diffFields(previous, country.toObject(), ['name', 'code', 'isActive', 'showOnWebsite', 'description', 'embassyEmail', 'slug']));
  sendSuccess(res, country, 'Country updated');
};

export const deleteCountry = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  await moveToTrash('country', country);
  logActivity(req, 'delete', 'Country', country.name);
  sendSuccess(res, null, 'Country moved to trash');
};

export const toggleCountryStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  country.isActive = !country.isActive;
  await country.save();
  sendSuccess(res, country, `Country ${country.isActive ? 'activated' : 'deactivated'}`);
};

export const toggleWebsiteVisibility = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  country.showOnWebsite = !country.showOnWebsite;
  await country.save();
  sendSuccess(res, country, `Country ${country.showOnWebsite ? 'shown on' : 'hidden from'} website`);
};

export const updateWebContent = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findByIdAndUpdate(
    req.params.id,
    { $set: { webContent: req.body } },
    { new: true, runValidators: true }
  );
  if (!country) { sendError(res, 'Country not found', 404); return; }
  sendSuccess(res, country, 'Country web content updated');
};

export const uploadCountryImage = async (req: AdminRequest, res: Response): Promise<void> => {
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  if (!req.file) { sendError(res, 'No image file provided', 400); return; }

  const { url } = await uploadToCloudinary(
    req.file.buffer,
    `countries/${country.slug || req.params.id}`,
    'image'
  );
  country.images = [...(country.images || []), url];
  await country.save();
  sendSuccess(res, country, 'Image uploaded');
};

export const removeCountryImage = async (req: AdminRequest, res: Response): Promise<void> => {
  const { imageUrl } = req.body;
  if (!imageUrl) { sendError(res, 'imageUrl is required', 400); return; }
  const country = await Country.findById(req.params.id);
  if (!country) { sendError(res, 'Country not found', 404); return; }
  country.images = (country.images || []).filter((u) => u !== imageUrl);
  await country.save();
  sendSuccess(res, country, 'Image removed');
};
