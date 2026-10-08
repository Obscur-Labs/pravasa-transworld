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

export interface CountryFaq {
  question: string;
  answer: string;
}

export interface CountryWebContent {
  overview?: string;
  requirements?: string;
  processingInfo?: string;
  tips?: string;
  faqs?: CountryFaq[];
}

export interface Country {
  _id: string;
  name: string;
  flag: string;
  description: string;
  slug?: string;
  showOnWebsite?: boolean;
  images?: string[];
  webContent?: CountryWebContent;
}

// Widened to plain string, these value sets are admin-configurable on the Visa Config page.
export type EntryType = string;
export type VisaSubType = string;
export type JurisdictionType = string;
export type VisaCategoryType = string;
export type ProcessType = 'normal' | 'express';

export interface VisaType {
  _id: string;
  country: Country;
  name: string;
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
  validity?: string;
  entry: EntryType[];
  visaSubType: VisaSubType;
  stayDuration: string;
  jurisdiction: JurisdictionType;
  visaCategory: VisaCategoryType;
  process: ProcessType;
  formFields: FormField[];
  documentRequirements: DocumentRequirement[];
  terms?: VisaTerm[];
  downloads?: VisaDownload[];
  additionalNotes?: string;
}

// A file the admin attached for applicants to download, e.g. a blank form or checklist.
export interface VisaDownload {
  _id?: string;
  name: string;
  url: string;
  fileName: string;
  size: number;
}

// Consent checkboxes shown on the Review & Pay step. Mandatory terms block submission.
export interface VisaTerm {
  _id?: string;
  text: string;
  required: boolean;
  defaultChecked: boolean;
  order: number;
}

export interface VaultDocument {
  _id: string;
  type: string;
  label: string;
  url: string;
  publicId: string;
  createdAt: string;
}

export type ApplicantType = 'adult' | 'child' | 'both';

export type FieldType = 'text' | 'number' | 'email' | 'date' | 'select' | 'radio' | 'textarea';

export interface FormField {
  _id: string;
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

/** The follow-ups the parent's current answer reveals. */
export const shownSubFields = (field: FormField, parentValue: string | undefined) =>
  (field.subFields || []).filter((sub) =>
    sub.showWhen.length > 0 ? sub.showWhen.includes(parentValue ?? '') : !!parentValue?.trim(),
  );

export interface DocumentRequirement {
  _id: string;
  name: string;
  description: string;
  required: boolean;
  applicantType?: ApplicantType;
  docType?: string;
  ocrEnabled?: boolean;
  // Shares one sequence with FormField.order, see mergeFormItems().
  order?: number;
}

/** A single row of the application form: either a question or a document upload. */
export type FormItem =
  | { kind: 'field'; order: number; field: FormField }
  | { kind: 'document'; order: number; doc: DocumentRequirement };

/**
 * Interleaves fields and documents into the single ordered list the applicant fill.
 *
 * `order` spans both arrays. When those orders are coherent (all distinct) they are
 * used as-is. Records written before documents had an `order` at all have every
 * document sitting at 0, which would interleave nonsensically, that duplication is
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

/** Original documents shipped in, when the mission wants paper rather than scans. */
export interface CourierRequest {
  requested: boolean;
  instructions: string;
  address: string;
  requestedAt: string | null;
  trackingNumber: string;
  phone: string;
  /** The applicant's estimate of when the shipment lands, not a confirmed arrival. */
  expectedDate: string;
  submittedAt: string | null;
  receivedAt: string | null;
}

/** The latest payment attempt on an application, as the applicant sees it. */
export interface ApplicationPayment {
  _id: string;
  amount: number;
  method: 'upi' | 'bank_transfer' | 'cash' | 'manual_override' | 'online';
  status: 'pending' | 'awaiting_verification' | 'completed' | 'failed' | 'refunded';
  utr?: string;
  rejectedUtr?: string;
  /** Short-lived link to the screenshot the applicant attached, if any. */
  proofUrl?: string;
  submittedAt?: string | null;
  failureReason?: string;
  failedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface Application {
  _id: string;
  visaType: VisaType;
  country: Country;
  status: ApplicationStatus;
  formResponses: Record<string, string>;
  adults: number;
  children: number;
  travelDate: string;
  rejectionReason: string;
  processingReferenceNumber?: string;
  embassyName?: string;
  submissionDate?: string;
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
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  /** Set when the notification is about a specific application, makes it clickable through to it. */
  application?: string | null;
  read: boolean;
  createdAt: string;
}

export interface VisaFile {
  _id: string;
  url: string;
}

export interface PromoCode {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  showOnWebsite: boolean;
}
