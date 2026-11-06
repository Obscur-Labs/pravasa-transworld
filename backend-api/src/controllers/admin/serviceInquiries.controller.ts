import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import ContactLead from '../../models/ContactLead';
import ServiceInquiry, { INQUIRY_STATUSES, InquiryStatus } from '../../models/ServiceInquiry';
import { logActivity } from '../../utils/activityLog';
import { sendSuccess, sendError } from '../../utils/response';
import { moveToTrash } from '../../utils/trash';
import Admin from '../../models/Admin';
import User from '../../models/User';
import VisaType from '../../models/VisaType';
import ApplicationDraft from '../../models/ApplicationDraft';
import ReplyTemplate from '../../models/ReplyTemplate';
import { encryptData } from '../../utils/encryption';
import { customerAppUrl, sendInquiryReplyEmail } from '../../services/email.service';

const isId = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const modelFor = (kind: string) => (kind === 'lead' ? ContactLead : ServiceInquiry) as unknown as typeof ServiceInquiry;
const entityOf = (kind: string) => (kind === 'lead' ? 'Contact Message' : 'Service Inquiry');
const count = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const DEFAULT_TEMPLATES = [
  { title: 'Thanks, calling soon', body: 'Namaste {name}, thank you for contacting Pravasa Transworld. Our team will call you shortly.' },
  { title: 'Need more details', body: 'Namaste {name}, thanks for your request. Could you share your travel dates and the number of travellers so we can help you faster?' },
  { title: 'Quote ready', body: 'Namaste {name}, your quote is ready. Please let us know a good time to walk you through the options.' },
  { title: 'Documents checklist', body: 'Namaste {name}, here is what we need to start: passport front and back, a recent photo with white background, and your travel dates.' },
];

/** Saved reply templates; the first visit seeds the four the page used to hardcode. */
export const getReplyTemplates = async (_req: AdminRequest, res: Response): Promise<void> => {
  if (!(await ReplyTemplate.exists({}))) await ReplyTemplate.insertMany(DEFAULT_TEMPLATES.map((t, order) => ({ ...t, order })));
  sendSuccess(res, await ReplyTemplate.find().sort({ order: 1 }));
};

/** Replaces the whole list in the order given. */
export const saveReplyTemplates = async (req: AdminRequest, res: Response): Promise<void> => {
  const raw: { title?: unknown; body?: unknown }[] = Array.isArray(req.body?.templates) ? req.body.templates : [];
  const list = raw
    .map((t) => ({ title: String(t?.title ?? '').trim().slice(0, 60), body: String(t?.body ?? '').trim().slice(0, 2000) }))
    .filter((t) => t.title && t.body)
    .slice(0, 30);
  await ReplyTemplate.deleteMany({});
  const saved = await ReplyTemplate.insertMany(list.map((t, order) => ({ ...t, order })));
  logActivity(req, 'update', 'Reply Templates', `${saved.length} reply templates saved`);
  sendSuccess(res, saved, 'Templates saved');
};

/** Records a reply, emails it when asked, and moves the inquiry on. WhatsApp opens in the admin's browser. */
export const sendInquiryReply = async (req: AdminRequest, res: Response): Promise<void> => {
  const body = String(req.body?.body ?? '').trim().slice(0, 4000);
  const channel = ['whatsapp', 'email', 'both'].includes(req.body?.channel) ? req.body.channel : 'whatsapp';
  if (!body) { sendError(res, 'Write a reply first'); return; }
  const doc = await modelFor(req.params.kind).findById(req.params.id);
  if (!doc) { sendError(res, 'Not found', 404); return; }
  if (channel !== 'whatsapp') {
    if (!doc.email) { sendError(res, 'This inquiry has no email address; reply on WhatsApp'); return; }
    try {
      await sendInquiryReplyEmail({ email: doc.email, name: doc.name, body });
    } catch (err) {
      console.error('Inquiry reply email failed', err);
      sendError(res, 'The email could not be sent', 502);
      return;
    }
  }
  doc.replies.push({ body, channel, by: req.admin?.name || 'Team', at: new Date() });
  if (req.body?.markAwaiting !== false) doc.status = 'awaiting_customer';
  else if (doc.status === 'new') doc.status = 'open';
  doc.read = true;
  await doc.save();
  logActivity(req, 'update', entityOf(req.params.kind), `${doc.name}: replied by ${channel === 'both' ? 'WhatsApp and email' : channel}`);
  sendSuccess(res, doc, 'Reply recorded');
};

export const assignInquiry = async (req: AdminRequest, res: Response): Promise<void> => {
  const assignee = req.body?.assignee ? String(req.body.assignee) : null;
  const who = assignee && isId(assignee) ? await Admin.findById(assignee).select('name') : null;
  if (assignee && !who) { sendError(res, 'Team member not found', 404); return; }
  const doc = await modelFor(req.params.kind).findByIdAndUpdate(req.params.id, { $set: { assignedTo: who?._id ?? null } }, { new: true });
  if (!doc) { sendError(res, 'Not found', 404); return; }
  logActivity(req, 'update', entityOf(req.params.kind), `${doc.name}: ${who ? `assigned to ${who.name}` : 'unassigned'}`);
  sendSuccess(res, doc, who ? `Assigned to ${who.name}` : 'Unassigned');
};

/**
 * Turns an inquiry into a started application: finds or creates the customer's account,
 * saves a draft for the chosen visa in their My Applications, and emails them to finish it.
 */
export const convertInquiry = async (req: AdminRequest, res: Response): Promise<void> => {
  const doc = await modelFor(req.params.kind).findById(req.params.id);
  if (!doc) { sendError(res, 'Not found', 404); return; }
  if (!doc.email) { sendError(res, 'An email address is needed to create the customer account'); return; }
  const visa = isId(req.body?.visaTypeId) ? await VisaType.findOne({ _id: req.body.visaTypeId, isActive: true }).select('name country') : null;
  if (!visa) { sendError(res, 'Choose a visa'); return; }
  const date = String(req.body?.travelDate || '');

  const user = (await User.findOne({ email: doc.email }))
    || (await User.create({ name: doc.name, email: doc.email, phone: doc.phone || '-' }));
  const draft = await ApplicationDraft.create({
    user: user._id,
    country: visa.country,
    visaType: visa._id,
    step: 3,
    travelStartDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    adults: count(req.body?.adults, 1, 10, 1),
    children: count(req.body?.children, 0, 9, 0),
    state: encryptData(JSON.stringify({ formData: {}, passportValues: {}, vaultPicks: [] })),
  });
  doc.convertedTo = { user: user._id, draft: draft._id, visaName: visa.name, at: new Date() } as typeof doc.convertedTo;
  doc.status = 'converted';
  doc.read = true;
  await doc.save();

  if (req.body?.notify !== false) {
    sendInquiryReplyEmail({
      email: doc.email,
      name: doc.name,
      body: `We have started your ${visa.name} application. Sign in with this email address to upload your documents and finish it; it is waiting under My Applications.`,
      link: customerAppUrl(`/apply?draft=${draft._id}`),
      linkLabel: 'Continue my application',
    }).catch((err) => console.error('Convert email failed', err));
  }
  logActivity(req, 'create', entityOf(req.params.kind), `${doc.name}: converted to a ${visa.name} application`);
  sendSuccess(res, doc, 'Application started for the customer');
};

/** Moves an inquiry or contact message along: new, open, awaiting customer, converted, closed. */
export const setInquiryStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const status = String(req.body?.status || '') as InquiryStatus;
  if (!INQUIRY_STATUSES.includes(status)) { sendError(res, 'Unknown status'); return; }
  const Model = req.params.kind === 'lead' ? ContactLead : ServiceInquiry;
  const doc = await (Model as typeof ServiceInquiry).findByIdAndUpdate(req.params.id, { $set: { status, read: true } }, { new: true });
  if (!doc) { sendError(res, 'Not found', 404); return; }
  logActivity(req, 'update', req.params.kind === 'lead' ? 'Contact Message' : 'Service Inquiry', `${doc.name}: ${status.replace('_', ' ')}`);
  sendSuccess(res, doc, 'Status updated');
};

export const getServiceInquiries = async (_req: AdminRequest, res: Response): Promise<void> => {
  const inquiries = await ServiceInquiry.find().sort({ createdAt: -1 });
  sendSuccess(res, inquiries);
};

export const markServiceInquiryRead = async (req: AdminRequest, res: Response): Promise<void> => {
  const inquiry = await ServiceInquiry.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!inquiry) { sendError(res, 'Inquiry not found', 404); return; }
  sendSuccess(res, inquiry, 'Marked as read');
};

export const deleteServiceInquiry = async (req: AdminRequest, res: Response): Promise<void> => {
  const inquiry = await ServiceInquiry.findById(req.params.id);
  if (!inquiry) { sendError(res, 'Inquiry not found', 404); return; }
  await moveToTrash('serviceInquiry', inquiry);
  sendSuccess(res, null, 'Inquiry moved to trash');
};
