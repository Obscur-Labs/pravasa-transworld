import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import OTP from '../models/OTP';
import { sendOTPEmail } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/response';

const generateOTP = (): string => String(Math.floor(100000 + Math.random() * 900000));

const signToken = (id: string): string =>
  jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, accountType, gstNumber } = req.body;

  if (!name || !email || !phone) {
    sendError(res, 'Name, email, and phone are required');
    return;
  }

  const type: 'individual' | 'corporate' = accountType === 'corporate' ? 'corporate' : 'individual';

  if (type === 'corporate' && !gstNumber) {
    sendError(res, 'GST number is required for corporate accounts');
    return;
  }

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({ name, email: email.toLowerCase(), phone, accountType: type, gstNumber: type === 'corporate' ? gstNumber : undefined });
  } else {
    user.name = name;
    user.phone = phone;
    user.accountType = type;
    if (type === 'corporate') user.gstNumber = gstNumber;
    await user.save();
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ email: email.toLowerCase(), role: 'user' });
  await OTP.create({ email: email.toLowerCase(), otp, role: 'user', expiresAt });

  try {
    await sendOTPEmail(email, name, otp);
  } catch (err: any) {
    console.error('[EMAIL ERROR] Failed to send OTP to', email, '—', err?.message ?? err);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    } else {
      sendError(res, 'Failed to send OTP email. Please try again.', 500);
      return;
    }
  }

  sendSuccess(res, { email }, 'OTP sent to your email');
};

export const sendLoginOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    sendError(res, 'Email is required');
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    sendError(res, 'No account found with this email', 404);
    return;
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ email: email.toLowerCase(), role: 'user' });
  await OTP.create({ email: email.toLowerCase(), otp, role: 'user', expiresAt });

  try {
    await sendOTPEmail(email, user.name, otp);
  } catch (err: any) {
    console.error('[EMAIL ERROR] Failed to send OTP to', email, '—', err?.message ?? err);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    } else {
      sendError(res, 'Failed to send OTP email. Please try again.', 500);
      return;
    }
  }

  sendSuccess(res, { email }, 'OTP sent to your email');
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    sendError(res, 'Email and OTP are required');
    return;
  }

  const record = await OTP.findOne({
    email: email.toLowerCase(),
    role: 'user',
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record || record.otp !== otp) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  record.verified = true;
  await record.save();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  const token = signToken(String(user._id));
  sendSuccess(res, { token, user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, accountType: user.accountType, gstNumber: user.gstNumber, promoApplicable: user.promoApplicable !== false } }, 'Login successful');
};

export const sendAdminOtp = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    sendError(res, 'Email is required');
    return;
  }

  const Admin = (await import('../models/Admin')).default;
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    sendError(res, 'No admin account found with this email', 404);
    return;
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ email: email.toLowerCase(), role: 'admin' });
  await OTP.create({ email: email.toLowerCase(), otp, role: 'admin', expiresAt });

  try {
    await sendOTPEmail(email, admin.name, otp);
  } catch (err: any) {
    console.error('[EMAIL ERROR] Failed to send admin OTP to', email, '—', err?.message ?? err);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Admin OTP for ${email}: ${otp}`);
    } else {
      sendError(res, 'Failed to send OTP email. Please try again.', 500);
      return;
    }
  }

  sendSuccess(res, { email }, 'OTP sent to admin email');
};

export const verifyAdminOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    sendError(res, 'Email and OTP are required');
    return;
  }

  const record = await OTP.findOne({
    email: email.toLowerCase(),
    role: 'admin',
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!record || record.otp !== otp) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  record.verified = true;
  await record.save();

  const { default: Admin, toAdminProfile } = await import('../models/Admin');
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    sendError(res, 'Admin not found', 404);
    return;
  }

  const token = jwt.sign(
    { id: admin._id, role: 'admin' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  sendSuccess(res, {
    token,
    admin: toAdminProfile(admin),
  }, 'Admin login successful');
};
