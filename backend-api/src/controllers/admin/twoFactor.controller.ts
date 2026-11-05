import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Admin, { toAdminProfile } from '../../models/Admin';
import { twoFactorEnforced } from '../../models/TeamSettings';
import { decryptData, encryptData } from '../../utils/encryption';
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpUri, verifyTotp } from '../../utils/totp';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

/**
 * Your own two-factor sign-in: start (secret + QR link), confirm with a first code
 * (returns one-time recovery codes), new recovery codes, and turning it off.
 */

export const startTwoFactor = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = req.admin!;
  if (admin.twoFactorEnabled) { sendError(res, 'Two-factor sign-in is already on'); return; }
  const secret = generateTotpSecret();
  await Admin.updateOne({ _id: admin._id }, { $set: { twoFactorPendingSecret: encryptData(secret) } });
  sendSuccess(res, { secret, uri: totpUri(secret, admin.username || admin.name) });
};

export const enableTwoFactor = async (req: AdminRequest, res: Response): Promise<void> => {
  const admin = await Admin.findById(req.admin!._id).select('+twoFactorPendingSecret').populate('role', 'name permissions');
  if (!admin?.twoFactorPendingSecret) { sendError(res, 'Start the setup again'); return; }
  const secret = decryptData(admin.twoFactorPendingSecret);
  if (!verifyTotp(secret, req.body?.code)) { sendError(res, 'That code is not right. Check the time on your phone and try again.'); return; }

  const codes = generateRecoveryCodes();
  admin.twoFactorEnabled = true;
  admin.twoFactorSecret = encryptData(secret);
  admin.recoveryCodes = codes.map(hashRecoveryCode);
  admin.set('twoFactorPendingSecret', undefined);
  await admin.save();
  logActivity(req, 'update', 'Team Member', `${admin.name}: turned on two-factor sign-in`);
  sendSuccess(res, { recoveryCodes: codes, profile: toAdminProfile(admin, await twoFactorEnforced()) }, 'Two-factor sign-in is on');
};

async function checkCurrentCode(adminId: unknown, code: unknown) {
  const admin = await Admin.findById(adminId).select('+twoFactorSecret').populate('role', 'name permissions');
  if (!admin?.twoFactorEnabled || !admin.twoFactorSecret) return { error: 'Two-factor sign-in is not on' };
  if (!verifyTotp(decryptData(admin.twoFactorSecret), code)) return { error: 'That code is not right' };
  return { admin };
}

export const regenerateRecoveryCodes = async (req: AdminRequest, res: Response): Promise<void> => {
  const r = await checkCurrentCode(req.admin!._id, req.body?.code);
  if ('error' in r) { sendError(res, r.error!); return; }
  const codes = generateRecoveryCodes();
  await Admin.updateOne({ _id: r.admin._id }, { $set: { recoveryCodes: codes.map(hashRecoveryCode) } });
  logActivity(req, 'update', 'Team Member', `${r.admin.name}: new recovery codes`);
  sendSuccess(res, { recoveryCodes: codes }, 'New recovery codes created; the old ones no longer work');
};

export const disableTwoFactor = async (req: AdminRequest, res: Response): Promise<void> => {
  if (await twoFactorEnforced()) { sendError(res, 'Your team requires two-factor sign-in, so it cannot be turned off'); return; }
  const r = await checkCurrentCode(req.admin!._id, req.body?.code);
  if ('error' in r) { sendError(res, r.error!); return; }
  await Admin.updateOne({ _id: r.admin._id }, { $set: { twoFactorEnabled: false }, $unset: { twoFactorSecret: 1, recoveryCodes: 1 } });
  r.admin.twoFactorEnabled = false;
  logActivity(req, 'update', 'Team Member', `${r.admin.name}: turned off two-factor sign-in`);
  sendSuccess(res, { profile: toAdminProfile(r.admin, false) }, 'Two-factor sign-in is off');
};
