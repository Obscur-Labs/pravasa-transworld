import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import Application, { IApplication, STATUS_LABELS } from '../../models/Application';
import Country from '../../models/Country';
import DocumentModel, { IDocument } from '../../models/Document';
import EmbassyMail from '../../models/EmbassyMail';
import EmbassyMailConfig from '../../models/EmbassyMailConfig';
import { EMBASSY_FROM_NAME, EMBASSY_FROM_EMAIL, EMBASSY_SENDER_IS_SHARED } from '../../config/email';
import { sendEmbassyMail } from '../../services/email.service';
import { logActivity } from '../../utils/activityLog';
import { fetchAsset } from '../../services/cloudinary.service';
import { getCompanyInfo } from '../../utils/receiptData';
import { sendSuccess, sendError } from '../../utils/response';
import {
  PLACEHOLDERS, FormDetail, listFormDetails, formatFormData, formatDocumentList, renderTemplate,
} from '../../utils/embassyMailTemplate';

// Brevo rejects a request whose attachments exceed 10 MB. Stop a little short of that
// so the reviewer gets a clear message here rather than an opaque provider error.
const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@x.com, b@y.com" → ['a@x.com', 'b@y.com']; also accepts an array as-is. */
function parseAddressList(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.join(',') : String(input ?? '');
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function describeTravellers(app: IApplication): string {
  const parts: string[] = [];
  const adults = app.adults || 0;
  const children = app.children || 0;
  if (adults > 0) parts.push(`${adults} adult${adults === 1 ? '' : 's'}`);
  if (children > 0) parts.push(`${children} child${children === 1 ? '' : 'ren'}`);
  return parts.join(', ') || '1 adult';
}

/** Every token the saved template can use, filled from this application. */
async function buildTokens(
  app: any,
  attached: IDocument[],
  details: FormDetail[],
): Promise<Record<string, string>> {
  const company = await getCompanyInfo();
  const travelDate = formatDate(app.travelDate);
  const travelEndDate = formatDate(app.travelEndDate);

  return {
    referenceId: app.referenceId || '',
    applicantName: app.user?.name || '',
    applicantEmail: app.user?.email || '',
    applicantPhone: app.user?.phone || '',
    country: app.country?.name || '',
    visaType: app.visaType?.name || '',
    travellers: describeTravellers(app),
    travelDates: travelEndDate ? `${travelDate} to ${travelEndDate}` : travelDate,
    travelDate,
    travelEndDate,
    adults: String(app.adults ?? 1),
    children: String(app.children ?? 0),
    embassyName: app.embassyName || '',
    processingReference: app.processingReferenceNumber || '',
    submissionDate: formatDate(app.submissionDate),
    expectedDate: formatDate(app.expectedDate),
    formData: formatFormData(details),
    documentList: formatDocumentList(attached),
    companyName: company.companyName,
    status: STATUS_LABELS[app.status as keyof typeof STATUS_LABELS] || app.status || '',
    today: formatDate(new Date()),
  };
}

async function loadConfig() {
  return EmbassyMailConfig.findOneAndUpdate({}, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
}

// The sender is env-driven, not editable here: Brevo silently rejects mail from an
// address that isn't a verified sender, so letting an admin type one would fail invisibly.
// Surfaced read-only instead, so what goes out is at least never a mystery.
const senderInfo = () => ({
  name: EMBASSY_FROM_NAME,
  email: EMBASSY_FROM_EMAIL,
  shared: EMBASSY_SENDER_IS_SHARED,
});

export const getEmbassyMailConfig = async (_req: AdminRequest, res: Response): Promise<void> => {
  const config = await loadConfig();
  sendSuccess(res, { config, placeholders: PLACEHOLDERS, sender: senderInfo() });
};

export const updateEmbassyMailConfig = async (req: AdminRequest, res: Response): Promise<void> => {
  const update: Record<string, string> = {};
  for (const field of ['subjectTemplate', 'bodyTemplate', 'defaultCc', 'replyTo'] as const) {
    if (req.body[field] !== undefined) update[field] = String(req.body[field]);
  }
  const config = await EmbassyMailConfig.findOneAndUpdate({}, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  logActivity(req, 'update', 'Embassy Mail Config', 'Default mail format');
  sendSuccess(res, { config, placeholders: PLACEHOLDERS, sender: senderInfo() }, 'Embassy mail format saved');
};

/**
 * Everything the composer opens with: the saved format already filled in with this
 * application's data, the form answers and documents available to include (with the
 * safe ones pre-selected), and what has been sent for this application before.
 *
 * The raw template and its tokens go out alongside the rendered draft so the composer
 * can re-render the message locally as details are ticked, without a round trip per tick.
 */
export const getEmbassyMailDraft = async (req: AdminRequest, res: Response): Promise<void> => {
  const application = await Application.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('visaType', 'name')
    .populate('country', 'name flag embassyEmail');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const config = await loadConfig();
  const documents = await DocumentModel.find({ application: application._id }).sort({ createdAt: 1 });

  // The draft is written as though the pre-selected set is what goes out, so
  // {{documentList}} lines up with the ticked boxes the admin is looking at.
  const preSelected = documents.filter((d) => d.status === 'approved');
  const formFields = listFormDetails(application);
  const tokens = await buildTokens(
    application,
    preSelected.length > 0 ? preSelected : documents,
    formFields.filter((f) => f.selected),
  );

  const history = await EmbassyMail.find({ application: application._id }).sort({ createdAt: -1 });

  sendSuccess(res, {
    to: (application.country as any)?.embassyEmail || '',
    cc: config.defaultCc,
    subject: renderTemplate(config.subjectTemplate, tokens),
    body: renderTemplate(config.bodyTemplate, tokens),
    bodyTemplate: config.bodyTemplate,
    tokens,
    formFields,
    documents: documents.map((d) => ({
      _id: d._id,
      requirementName: d.requirementName,
      status: d.status,
      selected: d.status === 'approved',
    })),
    history,
  });
};

/** Cloudinary URLs carry the original extension; keep it so the embassy gets a real file. */
function attachmentName(doc: IDocument, taken: Set<string>): string {
  const ext = (doc.url.split('?')[0].split('.').pop() || 'bin').toLowerCase();
  const base = doc.requirementName.replace(/[^a-zA-Z0-9\-_ ]/g, '_').trim() || 'document';
  let name = `${base}.${ext}`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n}).${ext}`;
  taken.add(name.toLowerCase());
  return name;
}

export const sendApplicationEmbassyMail = async (req: AdminRequest, res: Response): Promise<void> => {
  const { to, cc, subject, body, documentIds } = req.body || {};

  const recipient = String(to || '').trim();
  if (!EMAIL_RE.test(recipient)) { sendError(res, 'A valid recipient email address is required'); return; }
  if (!String(subject || '').trim()) { sendError(res, 'Subject is required'); return; }
  if (!String(body || '').trim()) { sendError(res, 'Message body is required'); return; }

  const ccList = parseAddressList(cc);
  const badCc = ccList.find((address) => !EMAIL_RE.test(address));
  if (badCc) { sendError(res, `"${badCc}" is not a valid CC address`); return; }

  const application = await Application.findById(req.params.id)
    .populate('user', 'name email')
    .populate('country', 'name');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  // Only documents belonging to this application can be attached, whatever was posted.
  const ids: string[] = Array.isArray(documentIds) ? documentIds.map(String) : [];
  const documents = ids.length > 0
    ? await DocumentModel.find({ _id: { $in: ids }, application: application._id }).sort({ createdAt: 1 })
    : [];

  // An embassy receiving half the paperwork is worse than an admin retrying, so one
  // unreachable file aborts the whole send rather than being quietly dropped.
  const taken = new Set<string>();
  const attachments: { name: string; content: string }[] = [];
  const logged: { document: any; name: string; size: number }[] = [];
  let totalBytes = 0;

  for (const doc of documents) {
    let buffer: Buffer;
    try {
      buffer = await fetchAsset(doc.url, doc.publicId);
    } catch (err) {
      console.error(`[EMBASSY_MAIL] Could not download "${doc.requirementName}"`, err);
      sendError(res, `Could not download "${doc.requirementName}". Nothing was sent. Please retry.`, 502);
      return;
    }

    totalBytes += buffer.length;
    if (totalBytes > MAX_ATTACHMENT_BYTES) {
      sendError(res, 'The selected documents exceed the 9 MB attachment limit. Send fewer documents per mail.');
      return;
    }

    const name = attachmentName(doc, taken);
    attachments.push({ name, content: buffer.toString('base64') });
    logged.push({ document: doc._id, name, size: buffer.length });
  }

  const config = await loadConfig();
  const company = await getCompanyInfo();

  try {
    await sendEmbassyMail({
      to: recipient,
      cc: ccList,
      replyTo: config.replyTo || undefined,
      subject: String(subject).trim(),
      body: String(body),
      attachments,
      companyName: company.companyName,
    });
  } catch (err: any) {
    const detail = err?.body?.message ?? err?.message ?? 'Unknown error';
    sendError(res, `The mail could not be sent: ${detail}`, 502);
    return;
  }

  const record = await EmbassyMail.create({
    application: application._id,
    to: recipient,
    cc: ccList,
    subject: String(subject).trim(),
    body: String(body),
    attachments: logged,
    sentBy: req.admin?._id || null,
    sentByName: req.admin?.name || 'Admin',
  });

  // Remember the address for this country so the next application pre-fills it.
  const countryId = (application.country as any)?._id;
  if (countryId) {
    await Country.updateOne({ _id: countryId }, { embassyEmail: recipient }).catch((err) =>
      console.error('[EMBASSY_MAIL] Could not remember the embassy address', err)
    );
  }

  logActivity(req, 'create', 'Embassy Mail', `${application.referenceId} → ${recipient}`);

  sendSuccess(res, record, `Mail sent to ${recipient}`);
};
