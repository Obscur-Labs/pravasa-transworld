export type ApplicationStatus =
  | 'submitted'
  | 'documents_under_review'
  | 'documents_approved'
  | 'payment_pending'
  | 'payment_completed'
  | 'visa_processing'
  | 'embassy_review'
  | 'visa_approved'
  | 'visa_rejected'
  | 'visa_delivered';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Application Submitted',
  documents_under_review: 'Documents Under Review',
  documents_approved: 'Documents Approved',
  payment_pending: 'Payment Pending',
  payment_completed: 'Payment Completed',
  visa_processing: 'Visa Processing',
  embassy_review: 'Embassy Review',
  visa_approved: 'Visa Approved',
  visa_rejected: 'Visa Rejected',
  visa_delivered: 'Visa Delivered',
};

export const ALL_STATUSES: ApplicationStatus[] = [
  'submitted', 'documents_under_review', 'documents_approved', 'payment_pending',
  'payment_completed', 'visa_processing', 'embassy_review', 'visa_approved',
  'visa_rejected', 'visa_delivered',
];

// Statuses an admin can set manually — mirrors the 4-step Application Progress (+ Rejected).
export const SELECTABLE_STATUSES: ApplicationStatus[] = [
  'submitted', 'payment_completed', 'visa_processing', 'visa_approved', 'visa_rejected',
];

// 'file' was dropped when fields and documents merged into one ordered list — a
// document requirement covers uploads properly (review lifecycle + OCR).
export type FieldType = 'text' | 'number' | 'email' | 'date' | 'select' | 'radio' | 'textarea';
export type ApplicantType = 'adult' | 'child' | 'both';

export interface FormField {
  _id?: string;
  label: string;
  fieldName: string;
  type: FieldType;
  required: boolean;
  options: string[];
  placeholder: string;
  order: number;
  applicantType?: ApplicantType;
  subFields?: SubField[];
}

// A follow-up shown under its parent. Empty `showWhen` means any answer reveals it.
export type SubField = Pick<FormField, 'label' | 'fieldName' | 'type' | 'required' | 'options' | 'placeholder'> & { showWhen: string[] };

export const hasOptions = (type: FieldType) => type === 'select' || type === 'radio';

export type DocumentType =
  | 'custom' | 'passport' | 'passport_front' | 'passport_back' | 'page' | 'photo' | 'aadhaar' | 'pan';

// Saved document kinds an admin can pick in form config. Passport front/back kinds
// auto-extract details from the uploaded image. `defaultName` pre-fills the requirement name.
export const DOC_TYPE_OPTIONS: { value: DocumentType; label: string; defaultName: string; extracts?: boolean }[] = [
  { value: 'custom', label: 'Custom (no OCR)', defaultName: '' },
  { value: 'passport_front', label: 'Passport Front (OCR)', defaultName: 'Passport Front', extracts: true },
  { value: 'passport_back', label: 'Passport Back (OCR)', defaultName: 'Passport Back', extracts: true },
  { value: 'page', label: 'Page', defaultName: 'Additional Page' },
];

export interface DocumentRequirement {
  _id?: string;
  name: string;
  description: string;
  required: boolean;
  applicantType?: ApplicantType;
  docType?: DocumentType;
  ocrEnabled?: boolean;
  // Shares one sequence with FormField.order — see mergeFormItems().
  order: number;
}

/** A single row of the application form: either a question or a document upload. */
export type FormItem =
  | { kind: 'field'; order: number; field: FormField }
  | { kind: 'document'; order: number; doc: DocumentRequirement };

/**
 * Interleaves fields and documents into the single ordered list admins author and applicants fill.
 *
 * `order` spans both arrays. When those orders are coherent (all distinct) they are
 * used as-is. Records written before documents had an `order` at all have every
 * document sitting at 0, which would interleave nonsensically — that duplication is
 * the tell, and such records fall back to "fields first, then documents" in stored
 * array order, exactly how they used to render. Opening and re-saving one in the
 * admin rewrites proper orders, so legacy data heals itself on first edit.
 */
export function mergeFormItems(fields: FormField[], docs: DocumentRequirement[]): FormItem[] {
  const items: FormItem[] = [
    ...fields.map((field): FormItem => ({ kind: 'field', order: field.order ?? 0, field })),
    ...docs.map((doc): FormItem => ({ kind: 'document', order: doc.order ?? 0, doc })),
  ];

  const orders = items.map((it) => it.order);
  if (new Set(orders).size !== orders.length) {
    return items.map((item, i) => ({ ...item, order: i }));
  }

  return items.sort((a, b) => a.order - b.order);
}

/**
 * Derives the machine key a field is stored under from its human label:
 * "Phone Number" → "phoneNumber". Admins never need to type this themselves.
 */
export function toFieldName(label: string): string {
  const camel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''));
  if (!camel) return '';
  // Mongo Map keys can't contain dots, and a leading digit makes an awkward key.
  return /^\d/.test(camel) ? `field${camel[0].toUpperCase()}${camel.slice(1)}` : camel;
}

/**
 * Prepares both arrays for saving:
 *  - drops rows the admin added but never filled in (a stray "Add Field" click),
 *  - fills any missing `fieldName` from the label, keeping keys unique,
 *  - rewrites `order` from position in the merged list, so the sequence an admin
 *    sees is exactly what gets persisted.
 *
 * Blank rows are dropped rather than rejected — the same way empty terms already are —
 * so an untouched row can never fail server-side validation.
 */
export function orderedFormArrays(fields: FormField[], docs: DocumentRequirement[]) {
  const kept = mergeFormItems(fields, docs).filter((it) =>
    it.kind === 'field'
      ? !!(it.field.label.trim() || it.field.fieldName.trim())
      : !!it.doc.name.trim(),
  );

  const seen = new Set<string>();
  const uniqueFieldName = (field: FormField): string => {
    const base = field.fieldName.trim() || toFieldName(field.label) || 'field';
    let name = base;
    for (let n = 2; seen.has(name); n++) name = `${base}${n}`;
    seen.add(name);
    return name;
  };

  return {
    formFields: kept.flatMap((it, i) =>
      it.kind === 'field' ? [{ ...it.field, label: it.field.label.trim() || it.field.fieldName.trim(), fieldName: uniqueFieldName(it.field), order: i }] : [],
    ),
    documentRequirements: kept.flatMap((it, i) =>
      it.kind === 'document' ? [{ ...it.doc, name: it.doc.name.trim(), order: i }] : [],
    ),
  };
}

// A consent checkbox shown to the applicant before payment. `required` blocks
// submission until ticked; `defaultChecked` pre-ticks it.
export interface VisaTerm {
  _id?: string;
  text: string;
  required: boolean;
  defaultChecked: boolean;
  order: number;
}

export interface CountryFaq {
  question: string;
  answer: string;
}

export interface CountryWebContent {
  heroTagline: string;
  overview: string;
  highlights: string[];
  requirements: string;
  processingInfo: string;
  tips: string;
  faqs: CountryFaq[];
}

export interface Country {
  _id: string;
  name: string;
  flag: string;
  /** Last embassy/agency address an application for this country was mailed to. */
  embassyEmail?: string;
  description: string;
  isActive: boolean;
  showOnWebsite: boolean;
  slug: string;
  images: string[];
  webContent: CountryWebContent;
}

// Widened to plain string — these value sets are admin-configurable on the Visa Config page.
export type EntryType = string;
export type VisaSubType = string;
export type JurisdictionType = string;
export type VisaCategoryType = string;
export type ProcessType = 'normal' | 'express';

export type VisaConfigCategory = 'jurisdiction' | 'visaCategory' | 'visaSubType' | 'entryType';

export interface VisaConfigOption {
  _id: string;
  category: VisaConfigCategory;
  value: string;
  label: string;
  order: number;
  isActive: boolean;
}

export interface ReceiptConfig {
  _id: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  fax: string;
  email: string;
  gstin: string;
  pan: string;
  stateName: string;
  stateCode: string;
  sacCode: string;
  logoUrl: string;
}

/** The house format every embassy mail starts from — one saved record, edited on the config page. */
export interface EmbassyMailConfig {
  _id: string;
  subjectTemplate: string;
  bodyTemplate: string;
  defaultCc: string;
  replyTo: string;
}

/** A {{token}} the template understands. Served by the backend so the docs can't drift. */
export interface EmbassyMailPlaceholder {
  token: string;
  description: string;
}

/** The address embassy mail actually goes out as — env-driven, shown read-only. */
export interface EmbassyMailSender {
  name: string;
  email: string;
  /** True when it shares the no-reply notification sender instead of having its own. */
  shared: boolean;
}

export interface EmbassyMailAttachment {
  document: string | null;
  name: string;
  size: number;
}

/** A mail that actually went out — the record kept against the application. */
export interface EmbassyMail {
  _id: string;
  to: string;
  cc: string[];
  subject: string;
  body: string;
  attachments: EmbassyMailAttachment[];
  sentByName: string;
  createdAt: string;
}

export interface EmbassyMailDraftDocument {
  _id: string;
  requirementName: string;
  status: 'pending' | 'approved' | 'rejected';
  /** Approved documents arrive pre-ticked; the admin can change that before sending. */
  selected: boolean;
}

/** One form answer, offered to the composer as its own tickable line. */
export interface EmbassyMailDraftField {
  /** The original form key — what the composer tracks its selection by. */
  key: string;
  /** "Adult 1", "Child 1", or empty for answers that belong to the trip as a whole. */
  group: string;
  label: string;
  value: string;
  /** Trip-wide answers arrive pre-ticked; each traveller's personal answers do not. */
  selected: boolean;
}

/** Everything the composer opens with: the filled-in format, what can be attached, what was sent before. */
export interface EmbassyMailDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  /** The raw saved template, so the composer can re-render as form details are ticked. */
  bodyTemplate: string;
  tokens: Record<string, string>;
  formFields: EmbassyMailDraftField[];
  documents: EmbassyMailDraftDocument[];
  history: EmbassyMail[];
}

export interface VisaType {
  _id: string;
  country: Country;
  name: string;
  description: string;
  price: number;
  adultPrice: number;
  childPrice: number;
  adultVfsFee?: number;
  childVfsFee?: number;
  adultServiceFee: number;
  childServiceFee: number;
  // Visa and VFS fees are the same for every account type; only the service fee
  // has a corporate override (0 waives it, unset charges the standard fee).
  corporateAdultServiceFee?: number;
  corporateChildServiceFee?: number;
  processingTime: string;
  validity: string;
  entry: EntryType[];
  visaSubType: VisaSubType;
  stayDuration: string;
  jurisdiction: JurisdictionType;
  visaCategory: VisaCategoryType;
  process: ProcessType;
  formFields: FormField[];
  documentRequirements: DocumentRequirement[];
  terms?: VisaTerm[];
  additionalNotes?: string;
  /** Admin-arranged position within its country. Listings sort on this, then name. */
  order?: number;
  isActive: boolean;
  createdAt: string;
}

export interface FormPreset {
  _id: string;
  name: string;
  description: string;
  formFields: FormField[];
  documentRequirements: DocumentRequirement[];
  createdAt: string;
  updatedAt: string;
}

export interface TermPreset {
  _id: string;
  name: string;
  description: string;
  terms: VisaTerm[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultDocument {
  _id: string;
  type: string;
  label: string;
  url: string;
  publicId: string;
  createdAt: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  gstNumber?: string;
  isActive: boolean;
  promoApplicable: boolean;
  createdAt: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface PromoCode {
  _id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  isActive: boolean;
  showOnWebsite: boolean;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromoUsage {
  user: string;
  userName: string;
  userEmail: string;
  applicationId?: string;
  applicationRef?: string;
  usedAt: string;
  discountApplied: number;
}

export interface PromoHistory {
  code: string;
  usageCount: number;
  usageLimit?: number;
  usedBy: PromoUsage[];
}

/** Original documents shipped in, when the mission wants paper rather than scans. */
export interface CourierRequest {
  requested: boolean;
  instructions: string;
  address: string;
  requestedAt: string | null;
  trackingNumber: string;
  phone: string;
  /** The applicant's estimate of when the shipment lands — not a confirmed arrival. */
  expectedDate: string;
  submittedAt: string | null;
  receivedAt: string | null;
}

export type PaymentStatus = 'pending' | 'awaiting_verification' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  _id: string;
  amount: number;
  // 'online' only appears on records from the retired card gateway.
  method: 'upi' | 'cash' | 'manual_override' | 'online';
  status: PaymentStatus;
  transactionId: string;
  utr?: string;
  rejectedUtr?: string;
  acceptedTerms?: string[];
  submittedAt?: string | null;
  verifyBy?: string | null;
  verifiedAt?: string | null;
  verifiedByName?: string;
  discountApplied?: number;
  failureReason: string;
  failedAt: string | null;
  paidAt: string | null;
  adminNote: string;
  createdAt: string;
}

/** A submitted UPI payment in the verification queue, with its application and customer. */
export interface PendingPayment extends Payment {
  application: { _id: string; referenceId: string; status: ApplicationStatus; visaType?: { name: string }; country?: { name: string; flag: string } } | null;
  user: { _id: string; name: string; email: string; phone: string } | null;
  promoCode?: { code: string } | null;
}

export interface PaymentConfig {
  _id: string;
  upiId: string;
  payeeName: string;
  merchantCode: string;
  verificationHours: number;
  terms: string[];
}

export interface Application {
  _id: string;
  user: User;
  visaType: VisaType;
  country: Country;
  status: ApplicationStatus;
  formResponses: Record<string, string>;
  adults: number;
  children: number;
  travelDate: string;
  travelEndDate?: string;
  rejectionReason: string;
  adminNotes: string;
  processingReferenceNumber?: string;
  embassyName?: string;
  submissionDate?: string;
  expectedDate?: string;
  paymentAmount: number;
  courier?: CourierRequest;
  referenceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  _id: string;
  requirementName: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string;
  docType?: string;
  extractedData?: Record<string, string>;
  reviewedAt: string | null;
  createdAt: string;
}

export interface VisaFile {
  _id: string;
  url: string;
}

export type TrashEntityType = 'country' | 'visaType' | 'formPreset' | 'termPreset' | 'contactLead' | 'application' | 'user';

export interface TrashItem {
  _id: string;
  entityType: TrashEntityType;
  entityLabel: string;
  label: string;
  sublabel: string;
  originalId: string;
  deletedAt: string;
}

export type ActivityAction = 'create' | 'update' | 'delete';

export interface AdminProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
}

export interface AdminNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  application: string | null;
  read: boolean;
  createdAt: string;
}

export const ACTION_BADGE = { create: 'success', update: 'info', delete: 'destructive' } as const;

export interface ActivityLog {
  _id: string;
  adminName: string;
  action: ActivityAction;
  entityType: string;
  entityLabel: string;
  createdAt: string;
}

export interface ContactLead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  read: boolean;
  createdAt: string;
}
