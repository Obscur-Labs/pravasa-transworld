import { Response } from 'express';
import archiver from 'archiver';
import { AdminRequest, hasAccess } from '../../middleware/adminAuth.middleware';
import Application, { APPLICATION_STATUSES, ApplicationStatus, EMPTY_COURIER, STATUS_LABELS } from '../../models/Application';
import Admin from '../../models/Admin';
import Country from '../../models/Country';
import Document from '../../models/Document';
import EmbassyMail from '../../models/EmbassyMail';
import Notification from '../../models/Notification';
import VisaFile from '../../models/VisaFile';
import User from '../../models/User';
import Payment from '../../models/Payment';
import Trash from '../../models/Trash';
import { deliveryUrl, fetchAsset, uploadToCloudinary } from '../../services/cloudinary.service';
import { sendDocumentStatusEmail, sendStatusUpdateEmail, sendVisaDeliveredEmail } from '../../services/email.service';
import { generateReceiptPDF } from '../../services/pdf.service';
import { buildReceiptData } from '../../utils/receiptData';
import { computeVisaPricing, computeSubtotal, computeGst, pricingTierOf } from '../../utils/pricing';
import { logActivity } from '../../utils/activityLog';
import { POST_PAYMENT_STAGES, PRE_PAYMENT_STAGES, hasCompletedPayment } from '../../services/payment.service';
import { sendSuccess, sendError } from '../../utils/response';
import { markChildrenBroken, parentAdults } from '../../utils/parentLink';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Work starts only after payment is verified: moving an application out of the pre-payment
// stages into processing needs a completed payment. Applications already past payment
// (including older ones from before this rule) are not held back.
// Documents review now comes after payment too. An older unpaid application already in
// documents review may still move between the two review stages.
const DOC_STAGES = ['documents_under_review', 'documents_approved'];
async function startsWorkUnpaid(application: { _id: unknown; status: string }, target: string): Promise<boolean> {
  if (!PRE_PAYMENT_STAGES.includes(application.status) || !POST_PAYMENT_STAGES.includes(target)) return false;
  if (DOC_STAGES.includes(application.status) && DOC_STAGES.includes(target)) return false;
  return !(await hasCompletedPayment(application._id));
}

// `limit=0` returns every match; `search` covers the application number and the applicant's name or email.
const isId = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

/**
 * Filters shared by the list and its CSV export: status, country, visa type, assignee
 * ('me', 'none' or a member id), submitted date range (IST), and a search over the
 * application and traveller IDs, applicant name, email, phone and passport number.
 */
async function applicationFilter(req: AdminRequest): Promise<Record<string, unknown>> {
  const { status, country, visaType, assignee, from, to, search } = req.query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (isId(country)) filter.country = country;
  if (isId(visaType)) filter.visaType = visaType;
  if (assignee === 'me') filter.assignedTo = req.admin!._id;
  else if (assignee === 'none') filter.assignedTo = null;
  else if (isId(assignee)) filter.assignedTo = assignee;
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  if (day(from) || day(to)) {
    filter.createdAt = {
      ...(day(from) ? { $gte: new Date(`${day(from)}T00:00:00+05:30`) } : {}),
      ...(day(to) ? { $lte: new Date(`${day(to)}T23:59:59.999+05:30`) } : {}),
    };
  }

  const term = String(search ?? '').trim();
  if (term) {
    const pattern = new RegExp(escapeRegex(term), 'i');
    const digits = term.replace(/\D/g, '');
    const [users, passportDocs] = await Promise.all([
      User.find({ $or: [{ name: pattern }, { email: pattern }, ...(digits.length >= 6 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])] }).select('_id'),
      /^[A-Z][0-9]{7}$/i.test(term) ? Document.find({ 'extractedData.Passport No': term.toUpperCase() }).select('application') : Promise.resolve([]),
    ]);
    filter.$or = [
      { referenceId: pattern },
      { 'travellers.ref': pattern },
      { user: { $in: users.map((u) => u._id) } },
      { _id: { $in: passportDocs.map((d) => d.application) } },
    ];
  }
  return filter;
}

export const getApplications = async (req: AdminRequest, res: Response): Promise<void> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(0, Number(req.query.limit ?? 20) || 0);
  const filter = await applicationFilter(req);

  const query = Application.find(filter)
    .populate('user', 'name email phone')
    .populate('visaType', 'name price')
    .populate('country', 'name flag')
    .populate('assignedTo', 'name')
    .sort({ createdAt: -1 });
  if (limit) query.skip((page - 1) * limit).limit(limit);

  const [applications, total] = await Promise.all([query, Application.countDocuments(filter)]);
  sendSuccess(res, { applications, total, page, pages: limit ? Math.ceil(total / limit) : 1 });
};

/** Team members who can work on applications, for the assignee pickers. */
export const getAssignees = async (_req: AdminRequest, res: Response): Promise<void> => {
  const admins = await Admin.find({ isActive: true, username: { $exists: true, $ne: '' } }).populate('role', 'name permissions').select('name isSuperAdmin role');
  sendSuccess(res, admins
    .filter((a) => a.isSuperAdmin || ['view', 'manage'].includes(String((a.role as unknown as { permissions?: Record<string, string> })?.permissions?.applications)))
    .map((a) => ({ _id: a._id, name: a.name })));
};

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The filtered list as CSV, for spreadsheets. */
export const exportApplicationsCsv = async (req: AdminRequest, res: Response): Promise<void> => {
  const apps = await Application.find(await applicationFilter(req))
    .populate('user', 'name email phone').populate('visaType', 'name').populate('country', 'name').populate('assignedTo', 'name')
    .sort({ createdAt: -1 }).limit(5000).lean();
  const ist = (d: Date) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 16);
  const rows = [
    ['Application', 'Applicant', 'Email', 'Phone', 'Country', 'Visa', 'Travellers', 'Status', 'Assignee', 'Amount (INR)', 'Submitted (IST)'],
    ...apps.map((a) => {
      const u = a.user as unknown as { name?: string; email?: string; phone?: string } | null;
      return [
        a.referenceId, u?.name, u?.email, u?.phone,
        (a.country as unknown as { name?: string })?.name, (a.visaType as unknown as { name?: string })?.name,
        `${a.adults} adult(s), ${a.children} child(ren)`, STATUS_LABELS[a.status] || a.status,
        (a.assignedTo as unknown as { name?: string })?.name || '', a.paymentAmount, ist(a.createdAt as unknown as Date),
      ];
    }),
  ];
  logActivity(req, 'create', 'Report Export', `Applications CSV (${apps.length} rows)`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.end(`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`);
};

async function resolveAssignee(raw: unknown): Promise<{ id: unknown; name: string } | { error: string }> {
  if (raw === null || raw === '' || raw === undefined) return { id: null, name: 'nobody' };
  if (!isId(raw)) return { error: 'Choose a team member' };
  const admin = await Admin.findOne({ _id: raw, isActive: true }).select('name');
  return admin ? { id: admin._id, name: admin.name } : { error: 'That team member is not active' };
}

/** Assigns one or many applications to a team member (or unassigns them). */
export const assignApplications = async (req: AdminRequest, res: Response): Promise<void> => {
  const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id]).filter(isId).slice(0, 200);
  if (!ids.length) { sendError(res, 'Choose at least one application'); return; }
  const who = await resolveAssignee(req.body?.assignee);
  if ('error' in who) { sendError(res, who.error); return; }
  const apps = await Application.find({ _id: { $in: ids } }).select('referenceId');
  await Application.updateMany({ _id: { $in: ids } }, { $set: { assignedTo: who.id } });
  for (const a of apps) logActivity(req, 'update', 'Application', `${a.referenceId}: assigned to ${who.name}`);
  sendSuccess(res, { updated: apps.length }, `${apps.length} application${apps.length === 1 ? '' : 's'} assigned to ${who.name}`);
};

export const getApplication = async (req: AdminRequest, res: Response): Promise<void> => {
  const application = await Application.findById(req.params.id)
    .select('+pricingTier')
    .populate('user', 'name email phone corporateType accountType')
    .populate('visaType')
    .populate('country');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const documents = await Document.find({ application: application._id });
  const visaFile = await VisaFile.findOne({ application: application._id });
  // Attempts, not just successes, a failed checkout is the reason an application sits
  // at payment_pending, and the reviewer needs to see it without leaving the page.
  const payments = await Payment.find({ application: application._id }).sort({ createdAt: -1 });
  // What has already been forwarded to the embassy, so a second send is a decision
  // rather than an accident.
  const embassyMails = await EmbassyMail.find({ application: application._id }).sort({ createdAt: -1 });

  // Family links across applications: the parent a child-only order travels on (with the
  // parent passports it reuses), and the child-only orders riding on this one.
  let linkedParent = null;
  if (application.parentLink) {
    const parent = await Application.findById(application.parentLink.application).select('referenceId status travellers formResponses adults');
    if (parent) {
      const linkedLabels = parentAdults(parent).filter((a) => application.parentLink!.parents.some((p) => p.key === a.key)).map((a) => a.label);
      const passports = (await Document.find({ application: parent._id, requirementName: /passport/i }))
        .filter((d) => !/^(Adult|Child) \d+/.test(d.requirementName) || linkedLabels.some((l) => d.requirementName.startsWith(`${l} -`)));
      linkedParent = { _id: parent._id, referenceId: parent.referenceId, status: parent.status, adults: parentAdults(parent).map(({ key, label, name }) => ({ key, label, name })), passports };
    }
  }
  const linkedChildren = await Application.find({ 'parentLink.application': application._id })
    .select('referenceId status parentLink children');
  const vfsLetterUrl = application.vfsAppointment?.letterUrl
    ? deliveryUrl(application.vfsAppointment.letterUrl, application.vfsAppointment.letterPublicId)
    : '';
  sendSuccess(res, { application, documents, visaFile, payments, embassyMails, linkedParent, linkedChildren, vfsLetterUrl });
};

const IST_MS = 5.5 * 3600000;
const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`);

// Stages where the team is working on an application (paid, not yet decided).
const IN_PROGRESS = ['payment_completed', 'documents_under_review', 'documents_approved', 'visa_processing', 'embassy_review'];
const STUCK_AFTER_DAYS = 3;

/**
 * Money and workload at a glance: revenue (only for staff who can see payments or
 * reports), payments waiting past their promised verification time, work in progress,
 * average days to deliver, and the applications that need someone today.
 */
async function operationsStats(req: AdminRequest) {
  const now = new Date();
  const today = istDay(now);
  const canSeeMoney = hasAccess(req.admin, 'payments', 'view') || hasAccess(req.admin, 'reports', 'view');

  const sumPaid = async (from: Date, to: Date) => (await Payment.aggregate([
    { $match: { status: 'completed', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]))[0]?.total ?? 0;

  let money = null;
  if (canSeeMoney) {
    const days = 14;
    const since = istStart(istDay(new Date(now.getTime() - (2 * days - 1) * 86400000)));
    const raw = await Payment.aggregate([
      { $match: { status: 'completed', paidAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: '+05:30' } }, total: { $sum: '$amount' } } },
    ]);
    const byDay = new Map<string, number>(raw.map((r) => [r._id as string, r.total as number]));
    const series = Array.from({ length: 2 * days }, (_, i) => {
      const d = istDay(new Date(since.getTime() + i * 86400000));
      return { date: d, revenue: byDay.get(d) || 0 };
    });
    money = {
      today: await sumPaid(istStart(today), now),
      month: await sumPaid(istStart(`${today.slice(0, 8)}01`), now),
      trend: series.slice(days),
      previous: series.slice(0, days),
    };
  }

  const [awaiting, overdue, inProgress, delivered, waitingPayments, staleApps, byStatus] = await Promise.all([
    Payment.countDocuments({ status: 'awaiting_verification' }),
    Payment.countDocuments({ status: 'awaiting_verification', verifyBy: { $lt: now } }),
    Application.countDocuments({ status: { $in: IN_PROGRESS } }),
    VisaFile.find({ createdAt: { $gte: new Date(now.getTime() - 30 * 86400000) } }).select('application createdAt').lean(),
    Payment.find({ status: 'awaiting_verification' }).sort({ verifyBy: 1 }).limit(5)
      .populate({ path: 'application', select: 'referenceId visaType', populate: { path: 'visaType', select: 'name' } })
      .populate('user', 'name').lean(),
    Application.find({ status: { $in: ['documents_under_review', 'payment_completed', 'embassy_review'] }, updatedAt: { $lt: new Date(now.getTime() - STUCK_AFTER_DAYS * 86400000) } })
      .sort({ updatedAt: 1 }).limit(5).populate('user', 'name').populate('visaType', 'name').select('referenceId status updatedAt user visaType').lean(),
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const deliveredApps = await Application.find({ _id: { $in: delivered.map((d) => d.application) } }).select('createdAt').lean();
  const createdOf = new Map(deliveredApps.map((a) => [String(a._id), new Date(a.createdAt).getTime()]));
  const spans = delivered
    .map((d) => (new Date((d as unknown as { createdAt: Date }).createdAt).getTime() - (createdOf.get(String(d.application)) ?? NaN)) / 86400000)
    .filter((x) => Number.isFinite(x) && x >= 0);

  const attention = [
    ...waitingPayments.map((p) => {
      const app = p.application as unknown as { _id: string; referenceId: string; visaType?: { name?: string } } | null;
      const due = p.verifyBy ? new Date(p.verifyBy).getTime() - now.getTime() : null;
      return {
        kind: 'payment' as const,
        applicationId: app?._id, referenceId: app?.referenceId || '', applicant: (p.user as unknown as { name?: string })?.name || '',
        visa: app?.visaType?.name || '', label: 'Payment to verify', dueInMinutes: due === null ? null : Math.round(due / 60000),
      };
    }),
    ...staleApps.map((a) => ({
      kind: 'stale' as const,
      applicationId: a._id, referenceId: a.referenceId, applicant: (a.user as unknown as { name?: string })?.name || '',
      visa: (a.visaType as unknown as { name?: string })?.name || '', label: `No update for ${Math.floor((now.getTime() - new Date(a.updatedAt).getTime()) / 86400000)} days`,
      dueInMinutes: null,
    })),
  ];

  return {
    money,
    pendingPayments: awaiting,
    overduePayments: overdue,
    inProgress,
    avgDeliveryDays: spans.length ? Math.round((spans.reduce((s, x) => s + x, 0) / spans.length) * 10) / 10 : null,
    attention,
    statusCounts: Object.fromEntries(byStatus.map((b) => [b._id, b.count])),
  };
}

export const getDashboardStats = async (req: AdminRequest, res: Response): Promise<void> => {
  const [total, pending, processing, approved, rejected] = await Promise.all([
    Application.countDocuments(),
    Application.countDocuments({ status: { $in: ['submitted', 'documents_under_review'] } }),
    Application.countDocuments({ status: { $in: ['payment_completed', 'visa_processing', 'embassy_review'] } }),
    Application.countDocuments({ status: 'visa_approved' }),
    Application.countDocuments({ status: 'visa_rejected' }),
  ]);

  // 14-day applications trend for the dashboard analytics widget.
  const days = 14;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const raw = await Application.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  const countByDate = new Map<string, number>(raw.map((r) => [r._id as string, r.count as number]));

  const trend: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, count: countByDate.get(key) || 0 });
  }

  // Applications-by-country breakdown for the dashboard pie chart.
  const byCountryRaw = await Application.aggregate([
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const countryIds = byCountryRaw.map((r) => r._id).filter(Boolean);
  const countryDocs = await Country.find({ _id: { $in: countryIds } }).select('name flag');
  const countryMap = new Map(countryDocs.map((c) => [String(c._id), c]));

  const TOP_N = 7;
  const sortedByCountry = byCountryRaw.map((r) => ({
    country: countryMap.get(String(r._id))?.name || 'Unknown',
    flag: countryMap.get(String(r._id))?.flag || '',
    count: r.count as number,
  }));
  const byCountry = sortedByCountry.slice(0, TOP_N);
  const otherCount = sortedByCountry.slice(TOP_N).reduce((sum, r) => sum + r.count, 0);
  if (otherCount > 0) byCountry.push({ country: 'Other', flag: '', count: otherCount });

  sendSuccess(res, { total, pending, processing, approved, rejected, trend, byCountry, ...(await operationsStats(req)) });
};

export const reviewDocument = async (req: AdminRequest, res: Response): Promise<void> => {
  const { documentId, status, rejectionReason } = req.body;
  if (!documentId || !status) { sendError(res, 'documentId and status are required'); return; }

  const doc = await Document.findOne({ _id: documentId, application: req.params.id });
  if (!doc) { sendError(res, 'Document not found', 404); return; }

  doc.status = status;
  doc.rejectionReason = rejectionReason || '';
  doc.reviewedAt = new Date();
  await doc.save();

  const application = await Application.findById(req.params.id);
  if (application) {
    // A rejection is a request for a new file, so the applicant needs the upload window
    // open again, an application already waved through to 'documents_approved' goes back
    // under review until the replacement arrives.
    if (status === 'rejected' && application.status === 'documents_approved') {
      application.status = 'documents_under_review';
      await application.save();
    }

    const notif = await Notification.create({
      user: application.user,
      title: status === 'rejected' ? 'Document Rejected: Re-upload Needed' : 'Document Reviewed',
      message: status === 'rejected'
        ? `Your document "${doc.requirementName}" was rejected: ${rejectionReason}. Open the application to upload a replacement. Only this document needs to be sent again.`
        : `Your document "${doc.requirementName}" has been reviewed.`,
      type: status === 'rejected' ? 'document_rejected' : 'general',
      application: application._id,
    });

    try {
      const { getIO } = await import('../../utils/socket');
      getIO().to(`user_${application.user}`).emit('notification', notif);
    } catch (err) {
      console.error('Socket emission failed', err);
    }

    if (status === 'rejected') {
      const user = await User.findById(application.user);
      if (user) {
        try {
          await sendDocumentStatusEmail(user.email, user.name, 'rejected', rejectionReason, application.referenceId);
        } catch (err) { console.error(err); }
      }
    }
  }

  sendSuccess(res, doc, 'Document reviewed');
};

export const approveAllDocuments = async (req: AdminRequest, res: Response): Promise<void> => {
  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  await Document.updateMany({ application: application._id, status: 'pending' }, { status: 'approved', reviewedAt: new Date() });

  // A rejected document is still waiting on a replacement, approving the rest must not
  // close the applicant's upload window behind it.
  const stillRejected = await Document.countDocuments({ application: application._id, status: 'rejected' });
  // Review only moves the status while the application sits in the review part of the
  // pipeline: an unpaid one keeps waiting for payment, a later one never moves back.
  const inReview = ['payment_completed', ...DOC_STAGES].includes(application.status);
  if (stillRejected > 0) {
    if (inReview) application.status = 'documents_under_review';
    await application.save();
    sendSuccess(res, application, `Pending documents approved. ${stillRejected} rejected document(s) still awaiting re-upload.`);
    return;
  }

  const visaType = await (await import('../../models/VisaType')).default.findById(application.visaType);
  if (inReview) application.status = 'documents_approved';
  // Preserve the per-traveler total locked at creation; only recompute if it was never set.
  if (visaType && (!application.paymentAmount || application.paymentAmount <= 0)) {
    const fullUser = await (await import('../../models/User')).default.findById(application.user);
    const breakdown = computeVisaPricing(visaType, pricingTierOf(fullUser), fullUser?._id);
    const numAdults = application.adults || 1;
    const numChildren = application.children || 0;
    const subtotal = computeSubtotal(breakdown, numAdults, numChildren);
    const gstAmount = computeGst(breakdown, numAdults, numChildren);
    application.paymentAmount = subtotal + gstAmount;
    application.adultBase = breakdown.adultBase;
    application.adultVfs = breakdown.adultVfs;
    application.adultFee = breakdown.adultFee;
    application.childBase = breakdown.childBase;
    application.childVfs = breakdown.childVfs;
    application.childFee = breakdown.childFee;
    application.gstAmount = gstAmount;
    application.pricingTier = pricingTierOf(fullUser);
  }
  await application.save();

  const user = application.user as unknown as { name: string; email: string };
  const notif = await Notification.create({
    user: application.user,
    title: 'Documents Approved',
    message: `Your documents for application ${application.referenceId} have been reviewed and approved.`,
    type: 'document_approved',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  try {
    await sendDocumentStatusEmail(user.email, user.name, 'approved', undefined, application.referenceId);
  } catch (err) { console.error(err); }

  sendSuccess(res, application, 'All documents approved');
};

/**
 * One status change with its side effects: the payment guard, the activity log, broken
 * family links, and (unless `notify` is false) an in-app note and email to the customer.
 * Returns an error message instead of throwing so bulk changes can report per item.
 */
async function changeStatus(
  req: AdminRequest,
  application: InstanceType<typeof Application>,
  status: string,
  extras: Record<string, unknown> = {},
  notify = true,
): Promise<string | null> {
  if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) return 'Unknown status';
  if (await startsWorkUnpaid(application, status)) return 'Verify the payment before moving this application into processing';

  const { rejectionReason, adminNotes, processingReferenceNumber, embassyName, submissionDate, expectedDate } = extras as Record<string, string | undefined>;
  const previousStatus = application.status;
  application.status = status as ApplicationStatus;
  if (rejectionReason) application.rejectionReason = rejectionReason;
  if (adminNotes) application.adminNotes = adminNotes;
  if (processingReferenceNumber !== undefined) application.processingReferenceNumber = processingReferenceNumber;
  if (embassyName !== undefined) application.embassyName = embassyName;
  if (submissionDate !== undefined) application.submissionDate = submissionDate;
  if (expectedDate !== undefined) application.expectedDate = expectedDate;
  await application.save();

  const user = application.user as unknown as { name: string; email: string };
  const label = STATUS_LABELS[status as ApplicationStatus] || status;
  logActivity(req, 'update', 'Application', `${application.referenceId} → ${label}${notify ? '' : ' (customer not notified)'}`,
    previousStatus !== status ? [{ field: 'status', from: STATUS_LABELS[previousStatus] || previousStatus, to: label }] : undefined);
  if (status === 'visa_rejected') await markChildrenBroken(application, 'was rejected');
  if (!notify) return null;

  const notif = await Notification.create({
    user: application.user,
    title: 'Application Status Updated',
    message: `Your application ${application.referenceId} status: ${label}`,
    type: 'status_update',
    application: application._id,
  });
  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }
  try {
    await sendStatusUpdateEmail(user.email, user.name, label, application.referenceId);
  } catch (err) { console.error(err); }
  return null;
}

/** Moves many applications to one status; each one still passes the payment guard. */
export const bulkUpdateStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter(isId).slice(0, 200);
  const status = String(req.body?.status || '');
  if (!ids.length || !status) { sendError(res, 'Choose applications and a status'); return; }
  const note = String(req.body?.note ?? '').trim().slice(0, 500);
  const apps = await Application.find({ _id: { $in: ids } }).populate('user', 'name email');
  const skipped: { referenceId: string; reason: string }[] = [];
  for (const app of apps) {
    const error = await changeStatus(req, app, status, note ? { adminNotes: note } : {}, req.body?.notify !== false);
    if (error) skipped.push({ referenceId: app.referenceId, reason: error });
  }
  const updated = apps.length - skipped.length;
  sendSuccess(res, { updated, skipped }, skipped.length ? `${updated} updated, ${skipped.length} skipped` : `${updated} updated`);
};

export const updateStatus = async (req: AdminRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  if (!status) { sendError(res, 'Status is required'); return; }

  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const error = await changeStatus(req, application, status, req.body);
  if (error) { sendError(res, error); return; }
  sendSuccess(res, application, 'Status updated');
};

// Ask the applicant to ship original documents (or withdraw the request). Nothing about
// this gates the application, it runs alongside whatever stage the application is at.
export const requestCourier = async (req: AdminRequest, res: Response): Promise<void> => {
  const { requested, instructions, address } = req.body || {};

  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  // Applications created before couriering existed have no subdocument to write into.
  if (!application.courier) application.courier = { ...EMPTY_COURIER };

  const isRequesting = requested !== false;
  if (!isRequesting) {
    // Withdrawing clears the whole exchange, including anything the applicant sent back,
    // so a later request starts clean rather than showing a stale consignment.
    application.courier = { ...EMPTY_COURIER };
    await application.save();
    logActivity(req, 'update', 'Application', `${application.referenceId}: courier request withdrawn`);
    sendSuccess(res, application, 'Courier request withdrawn');
    return;
  }

  application.courier.requested = true;
  application.courier.instructions = String(instructions || '');
  application.courier.address = String(address || '');
  application.courier.requestedAt = new Date();
  await application.save();

  logActivity(req, 'update', 'Application', `${application.referenceId}: documents requested by courier`);

  const notif = await Notification.create({
    user: application.user,
    title: 'Send Your Documents by Courier',
    message: `We need the original documents for application ${application.referenceId}. Open the application for the shipping address, then share the consignment number once you have sent them.`,
    type: 'courier_requested',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  const user = application.user as unknown as { name: string; email: string };
  try {
    await sendStatusUpdateEmail(user.email, user.name, 'Documents requested by courier', application.referenceId);
  } catch (err) { console.error(err); }

  sendSuccess(res, application, 'Courier request sent to the applicant');
};

// Confirm the shipment arrived, which closes the loop for the applicant.
export const markCourierReceived = async (req: AdminRequest, res: Response): Promise<void> => {
  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!application.courier?.requested) { sendError(res, 'No courier request on this application'); return; }

  application.courier.receivedAt = new Date();
  await application.save();

  logActivity(req, 'update', 'Application', `${application.referenceId}: courier documents received`);

  const notif = await Notification.create({
    user: application.user,
    title: 'Documents Received',
    message: `We have received the documents you couriered for application ${application.referenceId}.`,
    type: 'general',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  sendSuccess(res, application, 'Marked as received');
};

export const uploadVisaFile = async (req: AdminRequest, res: Response): Promise<void> => {
  if (!req.file) { sendError(res, 'Visa file is required'); return; }

  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (await startsWorkUnpaid(application, 'visa_delivered')) {
    sendError(res, 'Verify the payment before delivering the visa'); return;
  }

  // 'auto' keeps the real file type, so the visa opens inline instead of as a nameless binary.
  const { url, publicId } = await uploadToCloudinary(req.file.buffer, 'visa-files', 'auto', { private: true });

  const visaFile = await VisaFile.findOneAndUpdate(
    { application: application._id },
    { application: application._id, url, publicId },
    { upsert: true, new: true }
  );

  application.status = 'visa_delivered';
  await application.save();

  const user = application.user as unknown as { name: string; email: string };
  const notif = await Notification.create({
    user: application.user,
    title: 'Visa Delivered',
    message: `Your visa for application ${application.referenceId} is ready for download!`,
    type: 'visa_delivered',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  try {
    await sendVisaDeliveredEmail(user.email, user.name, application.referenceId, String(application._id));
  } catch (err) { console.error(err); }

  sendSuccess(res, { url: deliveryUrl(visaFile.url, visaFile.publicId) }, 'Visa uploaded and delivered');
};

export const manualPaymentOverride = async (req: AdminRequest, res: Response): Promise<void> => {
  const { adminNote } = req.body;

  const application = await Application.findById(req.params.id).populate('user', 'name email');
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!['payment_pending', 'submitted'].includes(application.status)) {
    sendError(res, 'Application is not awaiting payment'); return;
  }
  if (await Payment.exists({ application: application._id, status: 'awaiting_verification' })) {
    sendError(res, 'A customer payment for this application is waiting for verification. Approve or reject it first.', 409); return;
  }

  const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  await Payment.create({
    application: application._id,
    user: application.user,
    amount: application.paymentAmount,
    method: 'cash',
    status: 'completed',
    transactionId,
    markedByAdmin: true,
    adminNote: adminNote || 'Marked as paid by admin (cash)',
    paidAt: new Date(),
  });

  application.status = 'payment_completed';
  await application.save();

  const user = application.user as unknown as { name: string; email: string };
  const notif = await Notification.create({
    user: application.user,
    title: 'Payment Confirmed',
    message: `Your cash payment for application ${application.referenceId} has been confirmed by our team.`,
    type: 'status_update',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to(`user_${(application.user as any)._id}`).emit('notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  try {
    await sendStatusUpdateEmail(user.email, user.name, 'Payment Confirmed (Cash)', application.referenceId);
  } catch (err) { console.error(err); }

  sendSuccess(res, application, 'Payment marked as paid (cash override)');
};

export const getAdminPayments = async (_req: AdminRequest, res: Response): Promise<void> => {
  const payments = await Payment.find({ status: 'completed' })
    .populate({ path: 'application', populate: [{ path: 'visaType', select: 'name' }, { path: 'country', select: 'name flag' }] })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(200);
  // Hide payments whose application has been trashed (its application reference no longer resolves).
  sendSuccess(res, payments.filter((p) => p.application));
};

// Move an application to Trash. Snapshots the encrypted document (via lean, so it
// is NOT decrypted) and removes it from the collection; related documents/payments
// stay in place so a restore re-links them, and are purged on permanent delete.
export const deleteApplication = async (req: AdminRequest, res: Response): Promise<void> => {
  const app = await Application.findById(req.params.id).populate('visaType', 'name');
  if (!app) { sendError(res, 'Application not found', 404); return; }
  // Snapshot the raw stored BSON (encrypted formResponses preserved exactly) for a clean restore.
  const raw = await Application.collection.findOne({ _id: app._id });
  await Trash.create({
    entityType: 'application',
    label: app.referenceId || 'Application',
    sublabel: (app.visaType as any)?.name || '',
    originalId: app._id,
    data: raw,
  });
  await Application.deleteOne({ _id: app._id });
  await markChildrenBroken(app, 'was removed');
  logActivity(req, 'delete', 'Application', app.referenceId || 'Application');
  sendSuccess(res, null, 'Application moved to trash');
};

/** Per-customer totals: applications, verified payments (lifetime value) and last activity. */
async function customerTotals(userIds: unknown[]) {
  const [apps, paid] = await Promise.all([
    Application.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: '$user', count: { $sum: 1 }, last: { $max: '$updatedAt' } } }]),
    Payment.aggregate([{ $match: { user: { $in: userIds }, status: 'completed' } }, { $group: { _id: '$user', total: { $sum: '$amount' } } }]),
  ]);
  const appsOf = new Map(apps.map((a) => [String(a._id), a]));
  const paidOf = new Map(paid.map((p) => [String(p._id), p.total as number]));
  return (id: unknown) => ({
    applicationCount: appsOf.get(String(id))?.count ?? 0,
    lifetimeValue: paidOf.get(String(id)) ?? 0,
    lastActiveAt: appsOf.get(String(id))?.last ?? null,
  });
}

export const getUsers = async (req: AdminRequest, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = {};
  if (req.query.accountType) filter.accountType = req.query.accountType;
  const users = await User.find(filter).sort({ createdAt: -1 });
  const totals = await customerTotals(users.map((u) => u._id));
  sendSuccess(res, users.map((u) => ({ ...u.toJSON(), ...totals(u._id) })));
};

const customerType = (u: { accountType?: string; corporateType?: string }) =>
  u.accountType !== 'corporate' ? 'Individual' : u.corporateType === 'b2b_agent' ? 'B2B agent' : 'Corporate';

export const exportUsersCsv = async (req: AdminRequest, res: Response): Promise<void> => {
  const users = await User.find(req.query.accountType ? { accountType: req.query.accountType } : {}).sort({ createdAt: -1 }).limit(20000).lean();
  const totals = await customerTotals(users.map((u) => u._id));
  const day = (d?: Date | null) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : '');
  const rows = [
    ['Name', 'Email', 'Phone', 'Type', 'GSTIN', 'Applications', 'Lifetime value (INR)', 'Joined', 'Last active'],
    ...users.map((u) => {
      const t = totals(u._id);
      return [u.name, u.email, u.phone, customerType(u), u.gstNumber || '', t.applicationCount, t.lifetimeValue, day(u.createdAt as Date), day(t.lastActiveAt)];
    }),
  ];
  logActivity(req, 'create', 'Report Export', `Customers CSV (${users.length} rows)`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.end(`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`);
};

export const getUserApplications = async (req: AdminRequest, res: Response): Promise<void> => {
  const applications = await Application.find({ user: req.params.userId })
    .populate('visaType', 'name')
    .populate('country', 'name flag')
    .sort({ createdAt: -1 });
  sendSuccess(res, applications);
};

export const downloadApplicationReceipt = async (req: AdminRequest, res: Response): Promise<void> => {
  const payment = await Payment.findOne({ application: req.params.id, status: 'completed' })
    .populate({ path: 'application', populate: [{ path: 'visaType', select: 'name visaCategory' }, { path: 'country', select: 'name flag' }] })
    .populate('user', 'name email accountType gstNumber')
    .populate('promoCode', 'code');

  if (!payment) { sendError(res, 'No completed payment found for this application', 404); return; }

  const app = payment.application as any;

  const countryCode = (app.country?.flag || 'XX').toUpperCase();
  const yearShort = new Date(payment.paidAt || Date.now()).getFullYear().toString().slice(-2);
  const appLastNum = (app.referenceId || '').split('-').pop() || '0000';

  const allPayments = await Payment.find({ application: app._id, status: 'completed' }).sort({ paidAt: 1 });
  const seqIdx = allPayments.findIndex((p) => String(p._id) === String(payment._id));
  const seqNo = String((seqIdx >= 0 ? seqIdx : 0) + 1).padStart(3, '0');
  const receiptNumber = `${countryCode}-${appLastNum}-${yearShort}-${seqNo}`;

  try {
    const receiptData = await buildReceiptData(payment, receiptNumber);
    const pdfBuffer = await generateReceiptPDF(receiptData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${app.referenceId}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('[receipt] Failed to generate admin receipt PDF:', err);
    sendError(res, 'Failed to generate receipt', 500);
  }
};

export const downloadApplicationDocumentsZip = async (req: AdminRequest, res: Response): Promise<void> => {
  const docs = await Document.find({ application: req.params.id });

  if (docs.length === 0) {
    sendError(res, 'No documents found for this application', 404);
    return;
  }

  const application = await Application.findById(req.params.id).populate('visaType', 'name');
  const appRef = (application as any)?.referenceId || req.params.id;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="docs-${appRef}.zip"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  const archive = archiver('zip', { zlib: { level: 6 } });
  const closePromise = new Promise<void>((resolve, reject) => {
    archive.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(res);

  for (const doc of docs) {
    try {
      const buffer = await fetchAsset(doc.url, doc.publicId);
      const urlPath = doc.url.split('?')[0];
      const ext = urlPath.split('.').pop() || 'bin';
      const safeName = doc.requirementName.replace(/[^a-zA-Z0-9\-_]/g, '_');
      archive.append(buffer, { name: `${safeName}.${ext}` });
    } catch (err) {
      console.error(`Skipping doc ${doc._id}:`, err);
    }
  }

  archive.finalize();
  await closePromise;
};
