import { Response } from 'express';
import archiver from 'archiver';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import DocumentVault from '../../models/DocumentVault';
import User from '../../models/User';
import { fetchAsset } from '../../services/cloudinary.service';
import { sendSuccess, sendError } from '../../utils/response';
import { logActivity } from '../../utils/activityLog';
import { moveToTrash } from '../../utils/trash';

export const getUserVaultDocuments = async (req: AdminRequest, res: Response): Promise<void> => {
  const docs = await DocumentVault.find({ user: req.params.userId }).sort({ createdAt: -1 });
  sendSuccess(res, docs);
};

export const downloadUserVaultZip = async (req: AdminRequest, res: Response): Promise<void> => {
  const docs = await DocumentVault.find({ user: req.params.userId }).sort({ createdAt: -1 });

  if (docs.length === 0) {
    sendError(res, 'No vault documents found for this user', 404);
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="vault-documents.zip"');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  const archive = archiver('zip', { zlib: { level: 6 } });

  const closePromise = new Promise<void>((resolve, reject) => {
    archive.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(res);

  for (const doc of docs) {
    try {
      const buffer = await fetchAsset(doc.url, doc.publicId);
      const urlPath = doc.url.split('?')[0];
      const ext = urlPath.split('.').pop() || 'bin';
      const safeName = doc.label.replace(/[^a-zA-Z0-9\-_]/g, '_');
      archive.append(buffer, { name: `${safeName}_${String(doc._id).slice(-6)}.${ext}` });
    } catch (err) {
      console.error(`Skipping vault doc ${doc._id}:`, err);
    }
  }

  archive.finalize();
  await closePromise;
};

export const createUser = async (req: AdminRequest, res: Response): Promise<void> => {
  const { name, email, phone, accountType, gstNumber, isActive, promoApplicable } = req.body;
  if (!name || !email || !phone) {
    sendError(res, 'name, email, and phone are required', 400);
    return;
  }

  const type: 'individual' | 'corporate' = accountType === 'corporate' ? 'corporate' : 'individual';
  if (type === 'corporate' && !gstNumber) {
    sendError(res, 'GST number is required for corporate accounts', 400);
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) { sendError(res, 'A customer with this email already exists', 409); return; }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    accountType: type,
    gstNumber: type === 'corporate' ? String(gstNumber).trim() : undefined,
    isActive: isActive !== false,
    promoApplicable: promoApplicable !== false,
  });
  logActivity(req, 'create', 'Customer', user.name);
  sendSuccess(res, user, 'Customer created', 201);
};

export const updateUser = async (req: AdminRequest, res: Response): Promise<void> => {
  const { name, email, phone, accountType, gstNumber, isActive, promoApplicable } = req.body;
  const user = await User.findById(req.params.userId);
  if (!user) { sendError(res, 'Customer not found', 404); return; }

  if (email !== undefined) {
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!normalizedEmail) { sendError(res, 'Email cannot be empty', 400); return; }
    const dup = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (dup) { sendError(res, 'A customer with this email already exists', 409); return; }
    user.email = normalizedEmail;
  }
  if (name !== undefined) {
    if (!String(name).trim()) { sendError(res, 'Name cannot be empty', 400); return; }
    user.name = String(name).trim();
  }
  if (phone !== undefined) {
    if (!String(phone).trim()) { sendError(res, 'Phone cannot be empty', 400); return; }
    user.phone = String(phone).trim();
  }
  if (accountType !== undefined) {
    user.accountType = accountType === 'corporate' ? 'corporate' : 'individual';
  }
  if (gstNumber !== undefined) user.gstNumber = String(gstNumber).trim() || undefined;
  if (user.accountType === 'corporate' && !user.gstNumber) {
    sendError(res, 'GST number is required for corporate accounts', 400);
    return;
  }
  if (user.accountType === 'individual') user.gstNumber = undefined;
  if (isActive !== undefined) user.isActive = isActive === true;
  if (promoApplicable !== undefined) user.promoApplicable = promoApplicable === true;

  await user.save();
  logActivity(req, 'update', 'Customer', user.name);
  sendSuccess(res, user, 'Customer updated');
};

export const deleteUser = async (req: AdminRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.params.userId);
  if (!user) { sendError(res, 'Customer not found', 404); return; }
  // Applications and vault documents keep referencing the original id, so a
  // restore from trash re-links them without any extra work.
  await moveToTrash('user', user);
  logActivity(req, 'delete', 'Customer', user.name);
  sendSuccess(res, null, 'Customer moved to trash');
};

export const togglePromoApplicable = async (req: AdminRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.params.userId);
  if (!user) { sendError(res, 'User not found', 404); return; }
  user.promoApplicable = !user.promoApplicable;
  await user.save();
  sendSuccess(res, { _id: user._id, promoApplicable: user.promoApplicable });
};
