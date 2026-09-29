import mongoose, { Document, Schema } from 'mongoose';
import { encryptionPlugin } from '../plugins/encryptionPlugin';
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

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'submitted',
  'documents_under_review',
  'documents_approved',
  'payment_pending',
  'payment_completed',
  'visa_processing',
  'embassy_review',
  'visa_approved',
  'visa_rejected',
  'visa_delivered',
];

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

// Some missions want original papers in hand rather than scans. When the admin asks
// for them, the applicant ships the documents and reports the consignment back. The
// whole exchange sits outside the main flow, nothing here ever blocks an application.
export interface ICourierRequest {
  requested: boolean;
  instructions: string;
  address: string;
  requestedAt: Date | null;
  trackingNumber: string;
  phone: string;
  // When the applicant expects the shipment to land, so the office knows what to watch
  // for. Their estimate, not a commitment, receivedAt is what actually happened.
  expectedDate: string;
  submittedAt: Date | null;
  receivedAt: Date | null;
}

export interface IApplication extends Document {
  user: mongoose.Types.ObjectId;
  visaType: mongoose.Types.ObjectId;
  country: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  formResponses: Map<string, string>;
  adults: number;
  children: number;
  travelDate: string;
  travelEndDate: string;
  rejectionReason: string;
  adminNotes: string;
  processingReferenceNumber: string;
  embassyName: string;
  submissionDate: string;
  expectedDate: string;
  paymentAmount: number;
  // Per-traveler pricing snapshot at submission time, so receipts stay accurate even if
  // the visa type's price is edited later. base = visa fee, vfs = VFS fee, fee = service fee.
  adultBase: number;
  adultVfs: number;
  adultFee: number;
  childBase: number;
  childVfs: number;
  childFee: number;
  // 18% GST on the pre-GST subtotal, included in paymentAmount. 0 on legacy applications
  // created before GST was added on top (their paymentAmount has no GST component).
  gstAmount: number;
  // Snapshot of the visa terms the applicant ticked at submission, so the record of
  // what was agreed to survives later edits to the visa type's terms.
  acceptedTerms: { text: string; required: boolean }[];
  courier: ICourierRequest;
  referenceId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A cleared courier exchange, also the shape applications created before this existed get. */
export const EMPTY_COURIER: ICourierRequest = {
  requested: false, instructions: '', address: '', requestedAt: null,
  trackingNumber: '', phone: '', expectedDate: '', submittedAt: null, receivedAt: null,
};

const CourierSchema = new Schema<ICourierRequest>(
  {
    requested: { type: Boolean, default: false },
    instructions: { type: String, default: '' },
    address: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    trackingNumber: { type: String, default: '' },
    phone: { type: String, default: '' },
    expectedDate: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
  },
  { _id: false }
);

const ApplicationSchema = new Schema<IApplication>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visaType: { type: Schema.Types.ObjectId, ref: 'VisaType', required: true },
    country: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'submitted',
    },
    formResponses: { type: Map, of: String, default: {} },
    adults: { type: Number, default: 1, min: 1 },
    children: { type: Number, default: 0, min: 0 },
    travelDate: { type: String, default: '' },
    travelEndDate: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    processingReferenceNumber: { type: String, default: '' },
    embassyName: { type: String, default: '' },
    submissionDate: { type: String, default: '' },
    expectedDate: { type: String, default: '' },
    paymentAmount: { type: Number, default: 0 },
    adultBase: { type: Number, default: 0 },
    adultVfs: { type: Number, default: 0 },
    adultFee: { type: Number, default: 0 },
    childBase: { type: Number, default: 0 },
    childVfs: { type: Number, default: 0 },
    childFee: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    acceptedTerms: [{ text: { type: String }, required: { type: Boolean, default: false }, _id: false }],
    courier: { type: CourierSchema, default: () => ({}) },
    referenceId: { type: String, unique: true },
  },
  { timestamps: true }
);

ApplicationSchema.plugin(encryptionPlugin, { fields: ['formResponses'] });

ApplicationSchema.pre('save', function (next) {
  if (!this.referenceId) {
    const num = String(Math.floor(1000 + Math.random() * 9000));
    this.referenceId = `PRS-GEN-${num}`;
  }
  next();
});

export default mongoose.model<IApplication>('Application', ApplicationSchema);
