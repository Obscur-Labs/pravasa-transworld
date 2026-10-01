// Mirrors backend-api/src/config/permissions.ts. The server enforces these; the portal
// uses them to hide pages and explain access. Keep keys in step with the backend.

export type AccessLevel = 'view' | 'manage';

export const ACCESS_LABELS: Record<AccessLevel, string> = { view: 'View only', manage: 'Full access' };

export const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Overview stats and charts', viewOnly: true },
  { key: 'applications', label: 'Applications', description: 'Applications, documents, processing board, embassy mail' },
  { key: 'payments', label: 'Payments', description: 'Verify UPI and bank payments, record cash payments' },
  { key: 'countries', label: 'Countries & Visas', description: 'Countries, visa types, pricing, website content' },
  { key: 'customers', label: 'Customers', description: 'Customer accounts and their vault documents' },
  { key: 'promoCodes', label: 'Promo Codes', description: 'Discount codes and their usage' },
  { key: 'inquiries', label: 'Inquiries', description: 'Contact messages and service requests' },
  { key: 'formPresets', label: 'Form Presets', description: 'Reusable application forms' },
  { key: 'termPresets', label: 'Terms Presets', description: 'Reusable consent terms' },
  { key: 'visaConfig', label: 'Visa Config', description: 'Visa categories, entry types and other options' },
  { key: 'paymentSettings', label: 'Payment Settings', description: 'UPI ID, bank account, payment confirmations' },
  { key: 'receiptSettings', label: 'Receipt Settings', description: 'Receipt layout and company details' },
  { key: 'embassyMailSettings', label: 'Embassy Mail Settings', description: 'Default embassy mail template' },
  { key: 'trash', label: 'Trash', description: 'Restore or permanently delete removed items' },
  { key: 'activityLogs', label: 'Activity Logs', description: 'Who changed what, filterable by member and module', viewOnly: true },
] as const;

export type ModuleKey = (typeof ADMIN_MODULES)[number]['key'];
export type Permissions = Partial<Record<ModuleKey, AccessLevel>>;

export const isViewOnlyModule = (key: ModuleKey) => ADMIN_MODULES.some((m) => m.key === key && 'viewOnly' in m && m.viewOnly);
export const moduleLabel = (key: ModuleKey) => ADMIN_MODULES.find((m) => m.key === key)?.label ?? key;

// Notification kinds by the module they belong to (same map as the backend's notifications
// controller), so live socket pushes are filtered like the stored list.
const NOTIFICATION_MODULE: Record<string, ModuleKey> = {
  new_application: 'applications',
  status_update: 'applications',
  courier_shipped: 'applications',
  new_lead: 'inquiries',
  payment_received: 'payments',
  payment_submitted: 'payments',
  payment_reminder: 'payments',
  payment_failed: 'payments',
};
export const notificationModule = (type: string): ModuleKey | null => NOTIFICATION_MODULE[type] ?? null;

/** manage implies view. */
export const allows = (granted: AccessLevel | undefined, needed: AccessLevel) =>
  granted === 'manage' || (granted === 'view' && needed === 'view');
