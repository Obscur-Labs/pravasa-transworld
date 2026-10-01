import Admin from '../models/Admin';
import { hashPassword, passwordProblem } from '../utils/password';

// Used when SUPER_ADMIN_PASSWORD isn't set. Accounts on it are asked to change it.
export const DEFAULT_ADMIN_PASSWORD = 'Pravasa@123';

const toUsername = (email: string | undefined) =>
  (email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

/**
 * Runs at start-up and from the seed script.
 * 1. Migrates pre-RBAC data (text role field, email-only index).
 * 2. Gives every pre-RBAC admin a login and keeps them unrestricted super admins, as they
 *    were before: the oldest gets SUPER_ADMIN_USERNAME, the rest their email name.
 * 3. On an empty database, creates the super admin.
 * 4. SUPER_ADMIN_RESET_PASSWORD=true resets that account's password (account recovery).
 * Passwords set from the panel are never overwritten otherwise.
 */
export async function bootstrapAdmins(): Promise<void> {
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
