import mongoose from 'mongoose';
import Admin from '../models/Admin';
import ActivityLog, { logRetentionDays } from '../models/ActivityLog';
import { hashPassword, passwordProblem } from '../utils/password';

// Used when SUPER_ADMIN_PASSWORD isn't set. Accounts on it are asked to change it.
export const DEFAULT_ADMIN_PASSWORD = 'Pravasa@123';

const toUsername = (email: string | undefined) =>
  (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

// Entries written before logs recorded their module, mapped by what they describe.
const MODULE_BY_ENTITY: Record<string, string> = {
  Application: 'applications', 'Embassy Mail': 'applications', Payment: 'payments',
  Country: 'countries', 'Visa Type': 'countries', Customer: 'customers', 'Promo Code': 'promoCodes',
  'Form Preset': 'formPresets', 'Terms Preset': 'termPresets', 'Visa Config': 'visaConfig',
  'Payment Config': 'paymentSettings', 'Receipt Config': 'receiptSettings', 'Embassy Mail Config': 'embassyMailSettings',
  Role: 'team', 'Team Member': 'team',
};

/** Keeps the activity log TTL in line with ACTIVITY_LOG_RETENTION_DAYS (default 90). */
async function syncActivityLogRetention(): Promise<void> {
  const seconds = logRetentionDays() * 24 * 60 * 60;
  // Wait for Mongoose to finish building the schema indexes; collMod fails mid-build.
  await ActivityLog.init();
  const collection = ActivityLog.collection;
  const indexes = await collection.indexes().catch(() => [] as any[]);
  const ttl = indexes.find((i: any) => i.expireAfterSeconds !== undefined && Object.keys(i.key).join() === 'createdAt');
  if (!ttl) {
    await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: seconds });
  } else if (ttl.expireAfterSeconds !== seconds) {
    await mongoose.connection.db!.command({ collMod: collection.collectionName, index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: seconds } });
    console.log(`[ADMIN] Activity logs are now kept for ${logRetentionDays()} days.`);
  }
  await Promise.all(Object.entries(MODULE_BY_ENTITY).map(([entityType, module]) =>
    ActivityLog.updateMany({ entityType, $or: [{ module: { $exists: false } }, { module: '' }] }, { $set: { module } })));
}

/**
 * Runs at start-up and from the seed script.
 * 0. Applies the activity log retention and labels old entries with their module.
 * 1. Migrates pre-RBAC data (text role field, email-only index).
 * 2. Gives every pre-RBAC admin a login and keeps them unrestricted super admins, as they
 *    were before: the oldest gets SUPER_ADMIN_USERNAME, the rest their email name.
 * 3. On an empty database, creates the super admin.
 * 4. SUPER_ADMIN_RESET_PASSWORD=true resets that account's password (account recovery).
 * Passwords set from the panel are never overwritten otherwise.
 */
export async function bootstrapAdmins(): Promise<void> {
  await syncActivityLogRetention().catch((err) => console.error('[ADMIN] Activity log retention update failed', err));
  await Admin.collection.updateMany({ role: { $type: 'string' } }, { $unset: { role: '' } });
  await Admin.syncIndexes();

  const username = (process.env.SUPER_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const envPassword = process.env.SUPER_ADMIN_PASSWORD || '';
  const password = envPassword || DEFAULT_ADMIN_PASSWORD;
  const problem = passwordProblem(password);
  if (problem) { console.error(`[ADMIN] SUPER_ADMIN_PASSWORD rejected: ${problem}`); return; }
  // Without our own password in the environment, the default is public knowledge.
  const mustChangePassword = !envPassword;

  const taken = new Set((await Admin.find({ username: { $exists: true } }).select('username')).map((a) => a.username!));
  const unique = (base: string) => {
    let name = base.length >= 3 ? base : 'admin';
    for (let n = 2; taken.has(name); n++) name = `${base}${n}`;
    taken.add(name);
    return name;
  };

  const legacy = await Admin.find({ username: { $exists: false } }).sort({ createdAt: 1 });
  if (legacy.length) {
    const hash = await hashPassword(password);
    for (const [i, admin] of legacy.entries()) {
      const login = unique(i === 0 && !taken.has(username) ? username : toUsername(admin.email));
      admin.set({ username: login, passwordHash: hash, isSuperAdmin: true, isActive: true, role: null, mustChangePassword });
      await admin.save();
      console.log(`[ADMIN] "${admin.name}" can now sign in as "${login}" (super admin).`);
    }
  }

  const owner = await Admin.findOne({ username });
  if (!owner && !(await Admin.exists({ isSuperAdmin: true, username: { $exists: true } }))) {
    await Admin.create({
      name: process.env.ADMIN_NAME || 'Super Admin', phone: process.env.ADMIN_PHONE || '',
      username: unique(username), passwordHash: await hashPassword(password), isSuperAdmin: true, mustChangePassword,
    });
    console.log(`[ADMIN] Created super admin "${username}".`);
  }

  if (owner && process.env.SUPER_ADMIN_RESET_PASSWORD === 'true') {
    owner.set({
      passwordHash: await hashPassword(password), isSuperAdmin: true, isActive: true,
      failedLogins: 0, lockedUntil: null, sessionsValidFrom: new Date(), mustChangePassword,
    });
    await owner.save();
    console.log(`[ADMIN] Password reset for "${username}". Remove SUPER_ADMIN_RESET_PASSWORD now.`);
  }
}
