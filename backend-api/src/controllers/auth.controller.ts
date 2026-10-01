import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Admin, { toAdminProfile } from '../models/Admin';
import OTP, { IOTP, IPendingUser } from '../models/OTP';
import { sendOTPEmail } from '../services/email.service';
import { sendSuccess, sendError } from '../utils/response';
import { jwtSecret } from '../config/env';
import { verifyPassword } from '../utils/password';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = 'user' | 'admin';

const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();

export const signToken = (id: string, role: Role): string =>
  jwt.sign({ id, role }, jwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

// Keyed hash, so a leaked OTP collection can't be brute-forced offline.
const hashCode = (email: string, role: Role, code: string) =>
  crypto.createHmac('sha256', jwtSecret()).update(`${role}:${email}:${code}`).digest('hex');

const devPanelEnabled = () => process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_PANEL === 'true';

/** Creates a fresh code (replacing any earlier one) and mails it. Returns an error message on failure. */
async function issueOtp(email: string, role: Role, recipientName: string, pendingUser?: IPendingUser): Promise<{ status: number; message: string } | null> {
  const recent = await OTP.exists({ email, role, createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } });
  if (recent) return { status: 429, message: 'Please wait a few seconds before requesting another code' };

  const code = String(crypto.randomInt(100000, 1000000));
  await OTP.deleteMany({ email, role });
  await OTP.create({
    email,
    role,
    codeHash: hashCode(email, role, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    pendingUser,
    devCode: devPanelEnabled() ? code : undefined,
  });

  try {
    await sendOTPEmail(email, recipientName, code);
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Failed to send ${role} OTP to`, email, err?.message ?? err);
    if (process.env.NODE_ENV === 'production') {
      // Drop the unsent code so the resend cooldown doesn't block an immediate retry.
      await OTP.deleteMany({ email, role });
      return { status: 500, message: 'Failed to send OTP email. Please try again.' };
    }
    console.log(`[DEV] ${role} OTP for ${email}: ${code}`);
  }
  return null;
}

/** Spends one attempt on the current code. Returns the record on a match, else an error message. */
async function consumeOtp(email: string, role: Role, code: unknown): Promise<IOTP | string> {
  // The attempt is counted atomically before comparing, so parallel guesses can't exceed the cap.
  const record = await OTP.findOneAndUpdate(
    { email, role, codeHash: { $exists: true }, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!record) return 'Invalid or expired OTP. Please request a new code.';

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashCode(email, role, String(code ?? '').trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    const left = MAX_ATTEMPTS - record.attempts;
    return left > 0
      ? `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} left.`
      : 'Too many incorrect attempts. Please request a new code.';
  }

  await record.deleteOne();
  return record;
}

const userPayload = (user: InstanceType<typeof User>) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  accountType: user.accountType,
  gstNumber: user.gstNumber,
  promoApplicable: user.promoApplicable !== false,
});

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  const { name, phone, accountType, gstNumber } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!name || !email || !phone) {
    sendError(res, 'Name, email, and phone are required');
    return;
  }
  if (!EMAIL_RE.test(email)) {
    sendError(res, 'Please enter a valid email address');
    return;
  }

  const type: 'individual' | 'corporate' = accountType === 'corporate' ? 'corporate' : 'individual';
  if (type === 'corporate' && !gstNumber) {
    sendError(res, 'GST number is required for corporate accounts');
    return;
  }

  // Registration never touches an existing account. The details are only applied once
  // the code proves the caller owns this inbox.
  if (await User.exists({ email })) {
    sendError(res, 'An account with this email already exists. Please log in instead.', 409);
    return;
  }

  const failure = await issueOtp(email, 'user', String(name), {
    name: String(name),
    phone: String(phone),
    accountType: type,
    gstNumber: type === 'corporate' ? String(gstNumber) : undefined,
  });
  if (failure) { sendError(res, failure.message, failure.status); return; }

  sendSuccess(res, { email }, 'OTP sent to your email');
};

export const sendLoginOtp = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    sendError(res, 'Email is required');
    return;
  }

  const user = await User.findOne({ email });
  if (!user) {
    sendError(res, 'No account found with this email', 404);
    return;
  }

  const failure = await issueOtp(email, 'user', user.name);
  if (failure) { sendError(res, failure.message, failure.status); return; }

  sendSuccess(res, { email }, 'OTP sent to your email');
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body.email);
  if (!email || !req.body.otp) {
    sendError(res, 'Email and OTP are required');
    return;
  }

  const result = await consumeOtp(email, 'user', req.body.otp);
  if (typeof result === 'string') { sendError(res, result, 400); return; }

  let user = await User.findOne({ email });
  if (!user) {
    if (!result.pendingUser) {
      sendError(res, 'No account found with this email', 404);
      return;
    }
    const { name, phone, accountType, gstNumber } = result.pendingUser;
    user = await User.create({ name, email, phone, accountType, gstNumber: accountType === 'corporate' ? gstNumber : undefined });
  }
  if (!user.isActive) {
    sendError(res, 'This account has been deactivated. Please contact support.', 403);
    return;
  }

  sendSuccess(res, { token: signToken(String(user._id), 'user'), user: userPayload(user) }, 'Login successful');
};

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
// Compared against when the username doesn't exist, so both cases take the same time.
const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

/** Admin panel sign-in with username and password. Locks the account after repeated failures. */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!username || !password) { sendError(res, 'Username and password are required'); return; }

  const admin = await Admin.findOne({ username }).select('+passwordHash +failedLogins +lockedUntil').populate('role', 'name permissions');
  const invalid = () => sendError(res, 'Invalid username or password', 401);

  if (!admin) { await verifyPassword(password, DUMMY_HASH); invalid(); return; }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const mins = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    sendError(res, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 429);
    return;
  }

  if (!(await verifyPassword(password, admin.passwordHash))) {
    const failedLogins = (admin.failedLogins || 0) + 1;
    await Admin.updateOne({ _id: admin._id }, failedLogins >= MAX_FAILED_LOGINS
      ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } }
      : { $set: { failedLogins } });
    invalid();
    return;
  }
  if (!admin.isActive) { sendError(res, 'This account has been disabled. Contact your administrator.', 403); return; }

  await Admin.updateOne({ _id: admin._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  sendSuccess(res, {
    token: signToken(String(admin._id), 'admin'),
    admin: toAdminProfile(admin),
  }, 'Signed in');
};
