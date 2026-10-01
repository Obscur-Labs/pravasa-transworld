// Admin panel modules a role can be granted. Each grant is one of two access levels:
//   view   - read-only: open the pages and download files
//   manage - full CRUD: everything view allows, plus create, edit and delete
// Team & Roles is deliberately not a module; only super admins manage staff and roles.
// The admin portal mirrors this list in src/config/permissions.ts.

export const ACCESS_LEVELS = ['view', 'manage'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', viewOnly: true },
  { key: 'applications', label: 'Applications' },
  { key: 'payments', label: 'Payments' },
  { key: 'countries', label: 'Countries & Visas' },
  { key: 'customers', label: 'Customers' },
  { key: 'promoCodes', label: 'Promo Codes' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'formPresets', label: 'Form Presets' },
  { key: 'termPresets', label: 'Terms Presets' },
  { key: 'visaConfig', label: 'Visa Config' },
  { key: 'paymentSettings', label: 'Payment Settings' },
  { key: 'receiptSettings', label: 'Receipt Settings' },
  { key: 'embassyMailSettings', label: 'Embassy Mail Settings' },
  { key: 'trash', label: 'Trash' },
  { key: 'activityLogs', label: 'Activity Logs', viewOnly: true },
] as const;

export type ModuleKey = (typeof ADMIN_MODULES)[number]['key'];
export type Permissions = Partial<Record<ModuleKey, AccessLevel>>;

export const MODULE_KEYS = ADMIN_MODULES.map((m) => m.key) as ModuleKey[];
export const moduleLabel = (key: ModuleKey) => ADMIN_MODULES.find((m) => m.key === key)!.label;
const isViewOnly = (key: ModuleKey) => ADMIN_MODULES.some((m) => m.key === key && 'viewOnly' in m && m.viewOnly);

/** Keeps known modules and levels only; view-only modules are capped at view. */
export function cleanPermissions(input: unknown): Permissions {
  const out: Permissions = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, level] of Object.entries(input as Record<string, unknown>)) {
    if (!MODULE_KEYS.includes(key as ModuleKey) || !ACCESS_LEVELS.includes(level as AccessLevel)) continue;
    out[key as ModuleKey] = isViewOnly(key as ModuleKey) ? 'view' : (level as AccessLevel);
  }
  return out;
}

/** manage implies view. */
export const allows = (granted: AccessLevel | undefined, needed: AccessLevel) =>
  granted === 'manage' || (granted === 'view' && needed === 'view');
