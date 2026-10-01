import mongoose, { Document, Schema } from 'mongoose';
import { ADMIN_MODULES, type ModuleKey, type Permissions } from '../config/permissions';
import type { IAdminRole } from './AdminRole';

/** A staff account in the admin panel. Super admins bypass roles and manage the team. */
export interface IAdmin extends Document {
  name: string;
  username?: string;
  passwordHash?: string;
  email?: string;
  phone: string;
  isSuperAdmin: boolean;
  role: mongoose.Types.ObjectId | IAdminRole | null;
  isActive: boolean;
  /** Set for default or admin-set passwords; the panel prompts until it's changed. */
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  /** Sessions issued before this are rejected (password reset, deactivation). */
  sessionsValidFrom: Date | null;
  failedLogins: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    // Optional now; only used for payment alert emails.
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    isSuperAdmin: { type: Boolean, default: false },
    role: { type: Schema.Types.ObjectId, ref: 'AdminRole', default: null },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    sessionsValidFrom: { type: Date, default: null },
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Sparse so accounts without a username (pre-RBAC) or email don't collide.
AdminSchema.index({ username: 1 }, { unique: true, sparse: true });
AdminSchema.index({ email: 1 }, { unique: true, sparse: true });

/** What this account may do, per module. Super admins get full access to everything. */
export function effectivePermissions(admin: IAdmin): Permissions {
  if (admin.isSuperAdmin) {
    return Object.fromEntries(ADMIN_MODULES.map((m) => [m.key, 'viewOnly' in m && m.viewOnly ? 'view' : 'manage'])) as Permissions;
  }
  const role = admin.role as IAdminRole | null;
  return role && typeof role === 'object' && 'permissions' in role ? { ...(role.permissions || {}) } : {};
}

export const roleName = (admin: IAdmin) =>
  admin.isSuperAdmin ? 'Super Admin' : ((admin.role as IAdminRole | null)?.name ?? 'No role');

export const toAdminProfile = (admin: IAdmin) => ({
  _id: admin._id,
  name: admin.name,
  username: admin.username || '',
  email: admin.email || '',
  phone: admin.phone,
  isSuperAdmin: admin.isSuperAdmin,
  roleName: roleName(admin),
  permissions: effectivePermissions(admin),
  mustChangePassword: admin.mustChangePassword,
  createdAt: admin.createdAt,
});

export type { ModuleKey };
export default mongoose.model<IAdmin>('Admin', AdminSchema);
