import { Response } from 'express';
import mongoose from 'mongoose';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Admin, { IAdmin, effectivePermissions, roleName } from '../../models/Admin';
import AdminRole from '../../models/AdminRole';
import ActivityLog from '../../models/ActivityLog';
import { cleanPermissions } from '../../config/permissions';
import { hashPassword, passwordProblem } from '../../utils/password';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';

// Everything here sits behind requireSuperAdmin (see admin.routes).

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toMember = (a: IAdmin, lastActivityAt: Date | null = null) => ({
  _id: a._id,
  name: a.name,
  username: a.username || '',
  email: a.email || '',
  phone: a.phone,
  isSuperAdmin: a.isSuperAdmin,
  role: a.role && typeof a.role === 'object' && 'name' in a.role ? { _id: a.role._id, name: a.role.name } : null,
  roleName: roleName(a),
  permissions: effectivePermissions(a),
  isActive: a.isActive,
  mustChangePassword: a.mustChangePassword,
  hasLogin: !!a.username,
  lastLoginAt: a.lastLoginAt,
  lastActivityAt,
  createdAt: a.createdAt,
});

/** Other active super admins who can still sign in, so the team is never locked out. */
const otherSuperAdmins = (id: unknown) =>
  Admin.countDocuments({ _id: { $ne: id }, isSuperAdmin: true, isActive: true, username: { $exists: true, $ne: '' } });

// ── Roles ──────────────────────────────────────────────────────────────────────

export const getRoles = async (_req: AdminRequest, res: Response): Promise<void> => {
  const [roles, counts] = await Promise.all([
    AdminRole.find().sort({ name: 1 }).lean(),
    Admin.aggregate([{ $match: { role: { $ne: null } } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);
  const countOf = new Map(counts.map((c) => [String(c._id), c.count]));
  sendSuccess(res, roles.map((r) => ({ ...r, memberCount: countOf.get(String(r._id)) || 0 })));
};

function roleInput(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim().slice(0, 50);
  if (!name) return { error: 'Role name is required' };
  const permissions = cleanPermissions(body.permissions);
  if (!Object.keys(permissions).length) return { error: 'Give the role access to at least one module' };
  return { fields: { name, description: String(body.description ?? '').trim().slice(0, 200), permissions } };
}

const duplicateRole = (err: any) => err?.code === 11000;

export const createRole = async (req: AdminRequest, res: Response): Promise<void> => {
  const input = roleInput(req.body || {});
  if ('error' in input) { sendError(res, input.error!); return; }
  try {
    const role = await AdminRole.create(input.fields);
    logActivity(req, 'create', 'Role', role.name);
    sendSuccess(res, { ...role.toObject(), memberCount: 0 }, 'Role created', 201);
  } catch (err) {
    if (duplicateRole(err)) { sendError(res, 'A role with this name already exists', 409); return; }
    throw err;
  }
};

export const updateRole = async (req: AdminRequest, res: Response): Promise<void> => {
  const input = roleInput(req.body || {});
  if ('error' in input) { sendError(res, input.error!); return; }
  try {
    const role = await AdminRole.findByIdAndUpdate(req.params.id, { $set: input.fields }, { new: true });
    if (!role) { sendError(res, 'Role not found', 404); return; }
    logActivity(req, 'update', 'Role', role.name);
    sendSuccess(res, { ...role.toObject(), memberCount: await Admin.countDocuments({ role: role._id }) }, 'Role saved');
  } catch (err) {
    if (duplicateRole(err)) { sendError(res, 'A role with this name already exists', 409); return; }
    throw err;
  }
};

export const deleteRole = async (req: AdminRequest, res: Response): Promise<void> => {
  const role = await AdminRole.findById(req.params.id);
  if (!role) { sendError(res, 'Role not found', 404); return; }
  const members = await Admin.countDocuments({ role: role._id });
  if (members) { sendError(res, `${members} team member${members === 1 ? ' has' : 's have'} this role. Give them another role first.`, 409); return; }
  await role.deleteOne();
  logActivity(req, 'delete', 'Role', role.name);
  sendSuccess(res, null, 'Role deleted');
};

// ── Members ────────────────────────────────────────────────────────────────────

export const getMembers = async (_req: AdminRequest, res: Response): Promise<void> => {
  const [members, activity] = await Promise.all([
    Admin.find().populate('role', 'name permissions').sort({ isSuperAdmin: -1, createdAt: 1 }),
    ActivityLog.aggregate([{ $group: { _id: '$admin', last: { $max: '$createdAt' } } }]),
  ]);
  const lastOf = new Map(activity.map((a) => [String(a._id), a.last as Date]));
  sendSuccess(res, members.map((m) => toMember(m, lastOf.get(String(m._id)) ?? null)));
};

export const getMember = async (req: AdminRequest, res: Response): Promise<void> => {
  if (!mongoose.isValidObjectId(req.params.id)) { sendError(res, 'Team member not found', 404); return; }
  const member = await Admin.findById(req.params.id).populate('role', 'name permissions');
  if (!member) { sendError(res, 'Team member not found', 404); return; }
  const recentActivity = await ActivityLog.find({ admin: member._id }).sort({ createdAt: -1 }).limit(25).lean();
  sendSuccess(res, { member: toMember(member, recentActivity[0]?.createdAt ?? null), recentActivity });
};

/** Validates the member form. Password is required only when creating. */
async function memberInput(body: Record<string, any>, creating: boolean) {
  const name = String(body.name ?? '').trim().slice(0, 80);
  const username = String(body.username ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = body.password ? String(body.password) : '';
  const isSuperAdmin = body.isSuperAdmin === true;

  if (!name) return { error: 'Name is required' };
  if (!USERNAME_RE.test(username)) return { error: 'Username must be 3 to 30 characters: lowercase letters, numbers, dot, dash or underscore' };
  if (!PHONE_RE.test(phone)) return { error: 'Enter a valid phone number' };
  if (email && !EMAIL_RE.test(email)) return { error: 'That email address does not look right' };
  if (creating || password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
  }
  let role: unknown = null;
  if (!isSuperAdmin) {
    if (!mongoose.isValidObjectId(body.role) || !(await AdminRole.exists({ _id: body.role }))) return { error: 'Choose a role' };
    role = body.role;
  }
  return {
    fields: { name, username, phone, email: email || undefined, isSuperAdmin, role, isActive: body.isActive !== false },
    password,
  };
}

const conflict = (err: any) => {
  if (err?.code !== 11000) return null;
  return err.keyPattern?.email ? 'Another team member already uses this email' : 'This username is taken';
};

export const createMember = async (req: AdminRequest, res: Response): Promise<void> => {
  const input = await memberInput(req.body || {}, true);
  if ('error' in input) { sendError(res, input.error!); return; }
  try {
    const member = await Admin.create({ ...input.fields, passwordHash: await hashPassword(input.password), mustChangePassword: true });
    await member.populate('role', 'name permissions');
    logActivity(req, 'create', 'Team Member', `${member.name} (@${member.username})`);
    sendSuccess(res, toMember(member), 'Team member added', 201);
  } catch (err) {
    const message = conflict(err);
    if (message) { sendError(res, message, 409); return; }
    throw err;
  }
};

export const updateMember = async (req: AdminRequest, res: Response): Promise<void> => {
  const member = await Admin.findById(req.params.id);
  if (!member) { sendError(res, 'Team member not found', 404); return; }
  const input = await memberInput(req.body || {}, false);
  if ('error' in input) { sendError(res, input.error!); return; }

  const self = String(member._id) === String(req.admin!._id);
  const losingSuper = member.isSuperAdmin && (!input.fields.isSuperAdmin || !input.fields.isActive);
  if (self && losingSuper) { sendError(res, 'You cannot remove your own super admin access or disable yourself'); return; }
  if (losingSuper && !(await otherSuperAdmins(member._id))) { sendError(res, 'Keep at least one active super admin'); return; }

  const wasActive = member.isActive;
  member.set(input.fields);
  if (!input.fields.email) member.set('email', undefined);
  if (input.password) {
    member.passwordHash = await hashPassword(input.password);
    member.set({ failedLogins: 0, lockedUntil: null, mustChangePassword: String(member._id) !== String(req.admin!._id) });
  }
  // New password or disabled account: end every session this member has open.
  if (input.password || (wasActive && !input.fields.isActive)) member.sessionsValidFrom = new Date();

  try {
    await member.save();
  } catch (err) {
    const message = conflict(err);
    if (message) { sendError(res, message, 409); return; }
    throw err;
  }
  await member.populate('role', 'name permissions');
  logActivity(req, 'update', 'Team Member', `${member.name} (@${member.username})${input.password ? ', password reset' : ''}`);
  sendSuccess(res, toMember(member), 'Team member saved');
};

export const deleteMember = async (req: AdminRequest, res: Response): Promise<void> => {
  const member = await Admin.findById(req.params.id);
  if (!member) { sendError(res, 'Team member not found', 404); return; }
  if (String(member._id) === String(req.admin!._id)) { sendError(res, 'You cannot delete your own account'); return; }
  if (member.isSuperAdmin && !(await otherSuperAdmins(member._id))) { sendError(res, 'Keep at least one active super admin'); return; }
  await member.deleteOne();
  logActivity(req, 'delete', 'Team Member', `${member.name}${member.username ? ` (@${member.username})` : ''}`);
  sendSuccess(res, null, 'Team member removed');
};
