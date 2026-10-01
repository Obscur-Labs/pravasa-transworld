import { Request, Response } from 'express';
import ServiceInquiry, { InquiryDetail } from '../../models/ServiceInquiry';
import AdminNotification from '../../models/AdminNotification';
import { SERVICE_KEYS, SERVICE_SPECS, ServiceKey, FieldSpec } from '../../config/serviceInquiries';
import { getIO } from '../../utils/socket';
import { sendSuccess, sendError } from '../../utils/response';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const isActive = (field: FieldSpec, raw: Record<string, string>) => !field.when || field.when.in.includes(raw[field.when.key]);

/** Checks one form against its spec; returns cleaned raw values or an error message. */
function validate(fields: FieldSpec[], body: Record<string, unknown>): { values: Record<string, string> } | { error: string } {
  const raw: Record<string, string> = {};
  for (const f of fields) raw[f.key] = String(body[f.key] ?? '').trim().slice(0, f.type === 'longtext' ? 2000 : 200);

  const values: Record<string, string> = {};
  for (const f of fields) {
    if (!isActive(f, raw)) continue;
    const v = raw[f.key];
    if (!v) {
      if (f.required) return { error: `${f.label} is required` };
      continue;
    }
    if (f.type === 'choice' && !f.options!.includes(v)) return { error: `Choose a valid ${f.label.toLowerCase()}` };
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) {
        return { error: `${f.label} must be between ${f.min ?? 0} and ${f.max}` };
      }
    }
    if (f.type === 'date') {
      const t = Date.parse(`${v}T00:00:00Z`);
      if (!DATE_RE.test(v) || Number.isNaN(t)) return { error: `${f.label} is not a valid date` };
      // A day of slack so a visitor west of UTC can still pick "today".
      if (t < Date.now() - 2 * DAY) return { error: `${f.label} cannot be in the past` };
      if (f.after && values[f.after] && v < values[f.after]) {
        return { error: `${f.label} must be on or after ${fields.find((x) => x.key === f.after)!.label.toLowerCase()}` };
      }
    }
    if (f.differentFrom && v === values[f.differentFrom] && v !== 'Other') {
      return { error: `${f.label} must differ from ${fields.find((x) => x.key === f.differentFrom)!.label.toLowerCase()}` };
    }
    values[f.key] = f.type === 'number' ? String(Number(v)) : v;
  }
  return { values };
}

export const submitServiceInquiry = async (req: Request, res: Response): Promise<void> => {
  const service = req.params.service as ServiceKey;
  if (!SERVICE_KEYS.includes(service)) { sendError(res, 'Unknown service', 404); return; }
  const spec = SERVICE_SPECS[service];
  const body = (req.body || {}) as Record<string, unknown>;

  const name = String(body.name ?? '').trim().slice(0, 100);
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone ?? '').trim().slice(0, 30);
  const location = String(body.location ?? '').trim().slice(0, 100);
  if (!name) { sendError(res, 'Your name is required'); return; }
  if (email && !EMAIL_RE.test(email)) { sendError(res, 'That email address does not look right'); return; }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) { sendError(res, 'Enter a valid WhatsApp number'); return; }
  if (!location) { sendError(res, 'Your city or pincode is required'); return; }
  if (body.consent !== true && body.consent !== 'true') { sendError(res, 'Please accept the terms to send your request'); return; }

  const result = validate(spec.fields, body);
  if ('error' in result) { sendError(res, result.error); return; }

  // Store display-ready text so the admin panel can list any service without knowing its form.
  const display: Record<string, string> = {};
  const details: InquiryDetail[] = [];
  for (const f of spec.fields) {
    const v = result.values[f.key];
    if (v === undefined) continue;
    display[f.key] = f.type === 'date' ? formatDate(v) : v;
    details.push({ key: f.key, label: f.label, value: display[f.key] });
  }

  const inquiry = await ServiceInquiry.create({
    service, name, email, phone, location, details, summary: spec.summary(display),
  });

  const notif = await AdminNotification.create({
    title: `New ${spec.label} Inquiry`,
    message: `${name}: ${inquiry.summary}`,
    type: 'new_lead',
  });
  try { getIO().to('admin_room').emit('admin_notification', notif); } catch { /* sockets not running */ }

  sendSuccess(res, { _id: inquiry._id }, 'Request received', 201);
};
