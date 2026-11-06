import { AdminRequest } from '../middleware/adminAuth.middleware';
import ActivityLog, { ActivityAction, ActivityChange } from '../models/ActivityLog';

// Fire-and-forget: recording an activity entry should never fail the actual request.
// The module comes from the route guard that let the request through (requireModule).
export function logActivity(req: AdminRequest, action: ActivityAction, entityType: string, entityLabel: string, changes?: ActivityChange[]): void {
  ActivityLog.create({
    ...(changes?.length ? { changes: changes.slice(0, 50) } : {}),
    admin: req.admin?._id || null,
    adminName: req.admin?.name || 'Admin',
    action,
    module: req.permissionModule || '',
    entityType,
    entityLabel,
  }).catch((err) => console.error('Failed to record activity log', err));
}

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 300);
  return String(v).slice(0, 300);
};

/** Field-by-field changes between two versions of a record, for the activity log. */
export function diffFields(before: object | null | undefined, after: object, fields: string[]): ActivityChange[] {
  const b = (before || {}) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  return fields
    .map((field) => ({ field, from: show(b[field]), to: show(a[field]) }))
    .filter((c) => c.from !== c.to);
}
