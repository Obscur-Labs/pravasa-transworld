import Application, { IApplication } from '../models/Application';
import Payment from '../models/Payment';
import AdminNotification from '../models/AdminNotification';
import { notifyCustomer } from './customerNotify';

/**
 * Child-only orders (no adult on the order) travel on a parent's earlier application to
 * the same country. These helpers decide which applications can be that parent, mask
 * other customers' details, and break the link when the parent can no longer travel.
 */

// Paid and still alive. An unpaid parent is only eligible while its payment is being verified.
const ELIGIBLE_STATUSES = [
  'payment_completed', 'documents_under_review', 'documents_approved',
  'visa_processing', 'embassy_review', 'visa_approved', 'visa_delivered',
];
export const MAX_CHILDREN_PER_PARENT = 6;

const responsesOf = (app: Pick<IApplication, 'formResponses'>): Record<string, string> => {
  const r = app.formResponses as unknown;
  if (r instanceof Map) return Object.fromEntries(r);
  return (r as Record<string, string>) || {};
};

export interface ParentAdult { key: string; label: string; ref: string; name: string; dob: string }

/** The adults on an application. Applications from before per-traveller IDs fall back to their counts. */
export function parentAdults(app: IApplication): ParentAdult[] {
  const r = responsesOf(app);
  const adults = app.travellers?.length
    ? app.travellers.filter((t) => t.kind === 'adult')
    : Array.from({ length: app.adults || 0 }, (_, i) => ({ key: `a${i}`, label: `Adult ${i + 1}`, ref: app.referenceId }));
  return adults.map((t) => ({
    key: t.key,
    label: t.label,
    ref: t.ref,
    name: [r[`${t.label} - Given Name(s)`], r[`${t.label} - Surname`]].filter(Boolean).join(' '),
    dob: r[`${t.label} - Date of Birth`] || '',
  }));
}

export function tripDates(app: IApplication): { from: string; to: string } {
  const r = responsesOf(app);
  return { from: app.travelDate || r['Travel Start Date'] || '', to: app.travelEndDate || r['Travel End Date'] || '' };
}

/** "Rohan Mehta" → "R**** M****": enough to recognise your own family, no more. */
export const maskName = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}${'*'.repeat(Math.max(3, w.length - 1))}`).join(' ');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Passport scans read dates as 15/08/1985, 15 AUG 1985 or 1985-08-15; all become 1985-08-15. */
export function normalizeDob(raw: string): string {
  const s = String(raw || '').trim().toLowerCase();
  const pad = (n: number) => String(n).padStart(2, '0');
  let m = s.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/. ]+([a-z]{3,}|\d{1,2})[-/. ]+(\d{4})$/);
  if (!m) return '';
  const month = /\d/.test(m[2]) ? +m[2] : MONTHS.indexOf(m[2].slice(0, 3)) + 1;
  return month >= 1 && month <= 12 ? `${m[3]}-${pad(month)}-${pad(+m[1])}` : '';
}

export interface Eligibility { ok: boolean; code: string; reason: string }

/** Whether `parent` can carry a child-only order to `countryId` for the trip `from` to `to`. */
export async function checkParent(
  parent: IApplication,
  child: { countryId: unknown; from: string; to: string; excludeChildId?: unknown },
): Promise<Eligibility> {
  const no = (code: string, reason: string): Eligibility => ({ ok: false, code, reason });

  if (String(parent.country?._id ?? parent.country) !== String(child.countryId)) return no('NOT_SAME_COUNTRY', 'Different destination country');
  if (parent.parentLink) return no('IS_CHILD', 'This is itself a child-only application');
  if (!ELIGIBLE_STATUSES.includes(parent.status)) {
    if (parent.status === 'visa_rejected') return no('BAD_STATUS', 'This visa was rejected');
    const verifying = await Payment.exists({ application: parent._id, status: 'awaiting_verification' });
    if (!verifying) return no('BAD_STATUS', 'The parent application must be paid first');
  }
  if (!parentAdults(parent).length) return no('NO_ADULT', 'No adult traveller on this application');

  const { from, to } = tripDates(parent);
  const today = new Date().toISOString().slice(0, 10);
  if (to && to < today) return no('TRAVELLED', 'This trip has already ended');
  if (from && to && child.from && child.to && (child.from < from || child.to > to)) {
    return no('DATES_OUTSIDE', `The child's dates must fall within the parent's trip (${from} to ${to})`);
  }

  const linked = await Application.countDocuments({
    'parentLink.application': parent._id,
    'parentLink.status': 'ok',
    ...(child.excludeChildId ? { _id: { $ne: child.excludeChildId } } : {}),
  });
  if (linked >= MAX_CHILDREN_PER_PARENT) return no('LIMIT', `Already linked to ${MAX_CHILDREN_PER_PARENT} children`);
  return { ok: true, code: 'OK', reason: '' };
}

/**
 * The parent can no longer travel (rejected, removed): every child-only order riding on
 * it is flagged, and both the customer and the team are told.
 */
export async function markChildrenBroken(parent: Pick<IApplication, '_id' | 'referenceId'>, reason: string): Promise<void> {
  const children = await Application.find({ 'parentLink.application': parent._id, 'parentLink.status': 'ok' });
  for (const child of children) {
    child.parentLink!.status = 'broken';
    child.parentLink!.reason = reason;
    child.parentLink!.checkedAt = new Date();
    await child.save();
    await notifyCustomer(child, {
      title: 'Parent link broken',
      message: `Application ${child.referenceId} was linked to ${parent.referenceId}, which ${reason}. Our team will contact you to link it to another parent or guardian application.`,
    });
    await AdminNotification.create({
      title: 'Parent link broken',
      message: `${child.referenceId} lost its parent ${parent.referenceId} (${reason}). It is on hold until relinked.`,
      type: 'status_update',
      application: child._id,
    });
  }
}
