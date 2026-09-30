import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import User from '../../models/User';
import { uploadToCloudinary, deleteFromCloudinary } from '../../services/cloudinary.service';
import { sendSuccess, sendError } from '../../utils/response';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!._id).select('-__v -corporateType');
  if (!user) { sendError(res, 'User not found', 404); return; }
  sendSuccess(res, user);
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, phone, gstNumber } = req.body;
  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (phone?.trim()) updates.phone = phone.trim();
  if (gstNumber !== undefined) updates.gstNumber = gstNumber.trim();

  const user = await User.findByIdAndUpdate(req.user!._id, updates, { new: true }).select('-__v -corporateType');
  if (!user) { sendError(res, 'User not found', 404); return; }
  sendSuccess(res, user, 'Profile updated');
};

export const uploadProfilePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { sendError(res, 'File is required'); return; }

  const userId = String(req.user!._id);
  const existing = await User.findById(userId);

  if (existing?.profilePhotoPublicId) {
    try { await deleteFromCloudinary(existing.profilePhotoPublicId); } catch {}
  }

  const { url, publicId } = await uploadToCloudinary(req.file.buffer, `users/${userId}/profile`, 'image');
  const user = await User.findByIdAndUpdate(
    userId,
    { profilePhoto: url, profilePhotoPublicId: publicId },
    { new: true }
  ).select('-__v -corporateType');

  sendSuccess(res, user, 'Profile photo updated');
};
