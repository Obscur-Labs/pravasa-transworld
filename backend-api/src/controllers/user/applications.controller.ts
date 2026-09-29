import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import Application from '../../models/Application';
import Document from '../../models/Document';
import VisaFile from '../../models/VisaFile';
import VisaType from '../../models/VisaType';
import Country from '../../models/Country';
import VisaConfigOption from '../../models/VisaConfigOption';
import Payment from '../../models/Payment';
import { loadPaymentConfig } from '../../services/payment.service';
import { uploadToCloudinary } from '../../services/cloudinary.service';
import { extractPassport } from '../../services/ocr.service';
import { generateVisaSummaryPDF } from '../../services/pdf.service';
import { sendSuccess, sendError } from '../../utils/response';
import { computeVisaPricing, computeSubtotal, computeGst } from '../../utils/pricing';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!._id;
  const [active, pending, approved, rejected, total] = await Promise.all([
    Application.countDocuments({ user: userId, status: { $in: ['visa_processing', 'embassy_review', 'payment_completed'] } }),
    Application.countDocuments({ user: userId, status: { $in: ['submitted', 'documents_under_review', 'payment_pending'] } }),
    Application.countDocuments({ user: userId, status: { $in: ['visa_approved', 'visa_delivered'] } }),
    Application.countDocuments({ user: userId, status: 'visa_rejected' }),
    Application.countDocuments({ user: userId }),
  ]);

  const recent = await Application.find({ user: userId })
    .populate('visaType', 'name price')
    .populate('country', 'name flag')
    .sort({ createdAt: -1 })
    .limit(5);

  sendSuccess(res, { stats: { active, pending, approved, rejected, total }, recent });
};

export const getApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  const applications = await Application.find({ user: req.user!._id })
    .populate('visaType', 'name price processingTime')
    .populate('country', 'name flag')
    .sort({ createdAt: -1 });
  sendSuccess(res, applications);
};

export const createApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  const { visaTypeId, formResponses, adults, children, travelDate, acceptedTerms } = req.body;
  if (!visaTypeId) { sendError(res, 'Visa type is required'); return; }

  const visaType = await VisaType.findById(visaTypeId);
  if (!visaType || !visaType.isActive) { sendError(res, 'Visa type not found', 404); return; }

  // Terms are matched by text, since the client sends back the wording it displayed.
  const accepted: string[] = Array.isArray(acceptedTerms) ? acceptedTerms.map(String) : [];
  const missingTerm = (visaType.terms || []).find((t) => t.required && !accepted.includes(t.text));
  if (missingTerm) { sendError(res, 'Please accept all required terms before submitting'); return; }
  const acceptedSnapshot = (visaType.terms || [])
    .filter((t) => accepted.includes(t.text))
    .map((t) => ({ text: t.text, required: t.required }));

  const countryDoc = await Country.findById(visaType.country);
  const rawCode = (countryDoc?.code || countryDoc?.name || 'GEN')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');

  let referenceId = '';
  for (let i = 0; i < 10; i++) {
    const num = String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `PRS-${rawCode}-${num}`;
    const exists = await Application.findOne({ referenceId: candidate });
    if (!exists) { referenceId = candidate; break; }
  }
  if (!referenceId) referenceId = `PRS-${rawCode}-${Date.now().toString().slice(-4)}`;

  const isCorporate = req.user!.accountType === 'corporate';
  const numAdults = Math.max(1, Number(adults) || 1);
  const numChildren = Math.max(0, Number(children) || 0);

  const breakdown = computeVisaPricing(visaType, isCorporate);
  const { adultBase, adultVfs, adultFee, childBase, childVfs, childFee } = breakdown;
  const subtotal = computeSubtotal(breakdown, numAdults, numChildren);
  const gstAmount = computeGst(breakdown, numAdults, numChildren);
  const paymentAmount = subtotal + gstAmount;

  const application = await Application.create({
    user: req.user!._id,
    visaType: visaType._id,
    country: visaType.country,
    status: 'submitted',
    formResponses: formResponses || {},
    adults: numAdults,
    children: numChildren,
    travelDate: travelDate || (formResponses?.travelDate ?? ''),
    paymentAmount,
    adultBase, adultVfs, adultFee, childBase, childVfs, childFee, gstAmount,
    acceptedTerms: acceptedSnapshot,
    referenceId,
  });

  const populated = await Application.findById(application._id)
    .populate('visaType', 'name price processingTime')
    .populate('country', 'name flag');

  const AdminNotification = (await import('../../models/AdminNotification')).default;
  const { getIO } = await import('../../utils/socket');
  
  const notif = await AdminNotification.create({
    title: 'New Application Submitted',
    message: `A new application (${application.referenceId}) was submitted for ${visaType.name}.`,
    type: 'new_application',
    application: application._id,
  });

  try {
    getIO().to('admin_room').emit('admin_notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  sendSuccess(res, populated, 'Application submitted successfully', 201);
};

// Live OCR for the apply flow: reads a single passport image (front or back) and
// returns the extracted fields so the UI can pre-fill an editable review form.
// Does not persist anything.
export const scanPassport = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { sendError(res, 'Image file is required'); return; }
  if (!req.file.mimetype.startsWith('image/')) { sendError(res, 'Only image files can be scanned'); return; }
  const side: 'front' | 'back' = req.body.side === 'back' ? 'back' : 'front';
  try {
    const ocr = await extractPassport(req.file.buffer, side);
    sendSuccess(res, { fields: ocr.fields, confidence: ocr.confidence }, 'Passport scanned');
  } catch (err) {
    console.error('Passport scan failed:', err);
    sendError(res, 'Could not read the passport image', 500);
  }
};

export const getApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id })
    .populate('visaType')
    .populate('country');
  if (!application) { sendError(res, 'Application not found', 404); return; }

  const [documents, visaFile, payment, paymentConfig] = await Promise.all([
    Document.find({ application: application._id }),
    VisaFile.findOne({ application: application._id }),
    // Latest attempt only: enough to show "being verified" or why the last one was rejected.
    Payment.findOne({ application: application._id })
      .sort({ createdAt: -1 })
      .select('amount method status utr rejectedUtr submittedAt failureReason failedAt paidAt createdAt'),
    loadPaymentConfig(),
  ]);
  sendSuccess(res, { application, documents, visaFile, payment, verificationHours: paymentConfig.verificationHours });
};

// Stages during which an applicant may still add or swap documents.
const UPLOAD_STAGES = ['submitted', 'payment_completed', 'documents_under_review', 'documents_approved'];

// Rejecting a document is an explicit request for a replacement, so that one document
// stays replaceable even once the application has moved past the upload stages.
async function canReplace(applicationId: unknown, requirementName: string): Promise<boolean> {
  const existing = await Document.findOne({ application: applicationId, requirementName });
  return existing?.status === 'rejected';
}

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { sendError(res, 'File is required'); return; }
  const { requirementName } = req.body;
  if (!requirementName) { sendError(res, 'requirementName is required'); return; }

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }

  if (!UPLOAD_STAGES.includes(application.status) && !(await canReplace(application._id, requirementName))) {
    sendError(res, 'Cannot upload documents at this stage'); return;
  }

  const userId = String(req.user!._id);
  const { url, publicId } = await uploadToCloudinary(req.file.buffer, `users/${userId}/documents`, 'auto', { private: true });

  // Auto-extract passport details from the image. The doc kind comes from the
  // requirement's docType when sent; otherwise we fall back to the name.
  const docType: string = req.body.docType || '';
  const lowerName = requirementName.toLowerCase();
  const isPassport = docType.startsWith('passport') || lowerName.includes('passport');
  let extractedData: Record<string, string> = {};
  // Reviewed/edited values from the apply flow take precedence over a fresh OCR pass.
  if (req.body.extractedData) {
    try {
      const parsed = JSON.parse(req.body.extractedData);
      if (parsed && typeof parsed === 'object') extractedData = parsed;
    } catch { /* ignore malformed payload */ }
  }
  if (Object.keys(extractedData).length === 0 && isPassport && req.file.mimetype.startsWith('image/')) {
    const side: 'front' | 'back' =
      docType === 'passport_back' || /\bback\b/.test(lowerName) ? 'back' : 'front';
    try {
      const ocr = await extractPassport(req.file.buffer, side);
      extractedData = ocr.fields;
    } catch (err) {
      console.error('Passport OCR failed:', err);
    }
  }

  // Mongoose Map rejects keys containing "." — strip dots from all keys before DB write.
  const safeData = Object.fromEntries(
    Object.entries(extractedData).map(([k, v]) => [k.replace(/\./g, ''), v])
  );

  const existing = await Document.findOne({ application: application._id, requirementName });
  let doc;
  if (existing) {
    existing.url = url;
    existing.publicId = publicId;
    existing.status = 'pending';
    existing.rejectionReason = '';
    existing.reviewedAt = null;
    if (docType) existing.docType = docType;
    existing.extractedData = safeData as any;
    doc = await existing.save();
  } else {
    doc = await Document.create({ application: application._id, requirementName, url, publicId, docType, extractedData: safeData });
  }

  sendSuccess(res, doc, 'Document uploaded');
};

/**
 * Reports back a shipment of original documents the admin asked for. Every field is
 * accepted on its own — an applicant who only has a consignment number, or only a
 * contact number to reach them on, can still tell us what they know.
 */
export const submitCourierDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  const { trackingNumber, phone, expectedDate } = req.body || {};

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!application.courier?.requested) { sendError(res, 'No courier request on this application'); return; }

  const tracking = String(trackingNumber || '').trim();
  const contact = String(phone || '').trim();
  const eta = String(expectedDate || '').trim();
  if (!tracking && !contact && !eta) { sendError(res, 'Enter a consignment number, a contact number or an expected date'); return; }

  application.courier.trackingNumber = tracking;
  application.courier.phone = contact;
  application.courier.expectedDate = eta;
  application.courier.submittedAt = new Date();
  await application.save();

  const AdminNotification = (await import('../../models/AdminNotification')).default;
  const notif = await AdminNotification.create({
    title: 'Documents Couriered',
    message: `${req.user!.name} couriered the documents for application ${application.referenceId}${tracking ? ` — consignment ${tracking}` : ''}${eta ? `, expected around ${eta}` : ''}.`,
    type: 'courier_shipped',
    application: application._id,
  });

  try {
    const { getIO } = await import('../../utils/socket');
    getIO().to('admin_room').emit('admin_notification', notif);
  } catch (err) {
    console.error('Socket emission failed', err);
  }

  sendSuccess(res, application, 'Courier details saved');
};

export const getPublicCountries = async (_req: AuthRequest, res: Response): Promise<void> => {
  const countries = await Country.find({ isActive: true, showOnWebsite: true }).sort({ name: 1 });
  sendSuccess(res, countries);
};

// All active countries — for logged-in users applying for a visa.
// showOnWebsite is irrelevant here; a country can be active for applications without being public.
export const getActiveCountries = async (_req: AuthRequest, res: Response): Promise<void> => {
  const countries = await Country.find({ isActive: true }).sort({ name: 1 });
  sendSuccess(res, countries);
};

// Corporate pricing is only meant for logged-in corporate accounts — strip it from
// responses to anonymous visitors and individual accounts on these public endpoints.
// Includes retired override fields (corporate visa/VFS rates, legacy corporatePrice) so
// stale values on older documents never leak either.
const CORPORATE_PRICE_FIELDS = ['corporateAdultServiceFee', 'corporateChildServiceFee', 'corporateAdultPrice', 'corporateChildPrice', 'corporateAdultVfsFee', 'corporateChildVfsFee', 'corporatePrice'];
function sanitizeVisaType(visaType: Record<string, unknown>, includeCorporate: boolean) {
  if (includeCorporate) return visaType;
  const sanitized = { ...visaType };
  for (const field of CORPORATE_PRICE_FIELDS) delete sanitized[field];
  return sanitized;
}

export const getPublicCountryBySlug = async (req: AuthRequest, res: Response): Promise<void> => {
  const country = await Country.findOne({ slug: req.params.slug, isActive: true, showOnWebsite: true });
  if (!country) { sendError(res, 'Country not found', 404); return; }
  const visaTypes = await VisaType.find({ country: country._id, isActive: true }).sort({ order: 1, name: 1 }).lean();
  const includeCorporate = req.user?.accountType === 'corporate';
  sendSuccess(res, { country, visaTypes: visaTypes.map((vt) => sanitizeVisaType(vt, includeCorporate)) });
};

export const getPublicVisaTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  // Deactivating a country hides all of its visa types, regardless of each visa's own
  // isActive flag. This is enforced on read (non-destructive) so re-activating the country
  // restores exactly the per-visa states it had before.
  const activeCountryIds = await Country.find({ isActive: true }).distinct('_id');
  const filter: Record<string, unknown> = { isActive: true, country: { $in: activeCountryIds } };
  if (req.query.country) {
    const requested = String(req.query.country);
    filter.country = activeCountryIds.map(String).includes(requested) ? requested : { $in: [] as unknown[] };
  }
  // Same admin-arranged sequence the dashboard shows — see VisaType.order. `order` is
  // scoped per country, so group by country first for the (unfiltered) all-countries case.
  const visaTypes = await VisaType.find(filter).populate('country', 'name flag').sort({ country: 1, order: 1, name: 1 }).lean();
  const includeCorporate = req.user?.accountType === 'corporate';
  sendSuccess(res, visaTypes.map((vt) => sanitizeVisaType(vt, includeCorporate)));
};

// Public "Download PDF" button on the visa details view. Pricing is deliberately
// left out — the PDF is an information sheet, not a quote.
export const downloadVisaSummaryPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  const visaType = await VisaType.findOne({ _id: req.params.id, isActive: true }).populate('country', 'name');
  if (!visaType) { sendError(res, 'Visa type not found', 404); return; }

  const configOptions = await VisaConfigOption.find({ isActive: true }).select('category value label');
  const labelFor = (category: string, value: string | undefined) =>
    value ? configOptions.find((o) => o.category === category && o.value === value)?.label || value : undefined;

  const country = visaType.country as any;

  try {
    const pdfBuffer = await generateVisaSummaryPDF({
      visaName: visaType.name,
      countryName: country?.name || 'N/A',
      description: visaType.description,
      additionalNotes: visaType.additionalNotes,
      processingTime: visaType.processingTime,
      validity: visaType.validity,
      stayDuration: visaType.stayDuration,
      visaSubTypeLabel: labelFor('visaSubType', visaType.visaSubType),
      visaCategoryLabel: labelFor('visaCategory', visaType.visaCategory),
      entryLabels: (visaType.entry || []).map((e) => labelFor('entryType', e) || e),
      // Fields and documents are one authored sequence — the sheet lists them in that
      // same order so it matches what the applicant will actually see on the form.
      documents: [
        ...(visaType.formFields || []).flatMap((f) => [
          {
            kind: 'field' as const, order: f.order ?? 0,
            name: f.label || f.fieldName, description: f.placeholder || '', required: f.required, applicantType: f.applicantType,
          },
          ...(f.subFields || []).map((sub) => ({
            kind: 'field' as const, order: f.order ?? 0,
            name: `${sub.label} (if ${f.label}: ${sub.showWhen.length ? sub.showWhen.join(' / ') : 'answered'})`,
            description: sub.placeholder || '', required: sub.required, applicantType: f.applicantType,
          })),
        ]),
        ...(visaType.documentRequirements || []).map((d) => ({
          kind: 'document' as const, order: d.order ?? 0,
          name: d.name, description: d.description, required: d.required, applicantType: d.applicantType,
        })),
      ].sort((a, b) => a.order - b.order || (a.kind === b.kind ? 0 : a.kind === 'field' ? -1 : 1)),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="visa-details-${visaType.name.replace(/\s+/g, '-')}.pdf"`);
    res.end(pdfBuffer);
  } catch (err) {
    sendError(res, 'Failed to generate PDF', 500);
  }
};

import DocumentVault from '../../models/DocumentVault';

export const addDocumentFromVault = async (req: AuthRequest, res: Response): Promise<void> => {
  const { vaultDocId, requirementName } = req.body;
  if (!vaultDocId || !requirementName) { sendError(res, 'vaultDocId and requirementName are required'); return; }

  const application = await Application.findOne({ _id: req.params.id, user: req.user!._id });
  if (!application) { sendError(res, 'Application not found', 404); return; }
  if (!UPLOAD_STAGES.includes(application.status) && !(await canReplace(application._id, requirementName))) {
    sendError(res, 'Cannot add documents at this stage'); return;
  }

  const vaultDoc = await DocumentVault.findOne({ _id: vaultDocId, user: req.user!._id });
  if (!vaultDoc) { sendError(res, 'Vault document not found', 404); return; }

  const existing = await Document.findOne({ application: application._id, requirementName });
  let doc;
  if (existing) {
    existing.url = vaultDoc.url;
    existing.publicId = vaultDoc.publicId;
    existing.status = 'pending';
    existing.rejectionReason = '';
    existing.reviewedAt = null;
    doc = await existing.save();
  } else {
    doc = await Document.create({ application: application._id, requirementName, url: vaultDoc.url, publicId: vaultDoc.publicId });
  }
  sendSuccess(res, doc, 'Document linked from vault');
};
