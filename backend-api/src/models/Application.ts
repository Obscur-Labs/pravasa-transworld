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

// Pipeline order: the customer pays at submission, documents are reviewed after the
// payment is verified, then the file goes to the embassy.
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'submitted',
  'payment_pending',
  'payment_completed',
  'documents_under_review',
  'documents_approved',
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

export type ParentRelation = 'father' | 'mother' | 'guardian';
export const PARENT_RELATIONS: ParentRelation[] = ['father', 'mother', 'guardian'];

// How a traveller gets to the embassy: they visit VFS for biometrics, or Pravasa submits
// for them because their fingerprints are still reusable (Schengen: taken within 2 years).
export type SubmissionMode = '' | 'visit_vfs' | 'pravasa';
export interface ISubmission {
  mode: SubmissionMode;
  biometricsWithin2Years: '' | 'yes' | 'no';
  previousVisaVerified: boolean;
  centre: string;
  reference: string;
  date: string;
  notifiedAt: Date | null;
}

// One person on the order. The order's referenceId is the family group; each traveller
// gets its own ID under it. Names stay in the encrypted formResponses, never here.
export interface ITraveller {
  ref: string;
  key: string;
  kind: 'adult' | 'child';
  label: string;
  // Only on children: the adults on the same order who are this child's parents or guardian.
  parents: { key: string; relation: ParentRelation }[];
  submission?: ISubmission;
}

// A child-only order travels on a parent's earlier application. `parents` are adult
// traveller keys on that application. A rejected or removed parent breaks the link.
export interface IParentLink {
  application: mongoose.Types.ObjectId;
  ref: string;
  parents: { key: string; relation: ParentRelation }[];
  status: 'ok' | 'broken';
  reason: string;
  checkedAt: Date;
}

export interface IVfsAppointment {
  centre: string;
  date: string;
  time: string;
  reference: string;
  letterUrl: string;
  letterPublicId: string;
  letterName: string;
  sentAt: Date | null;
}

// Documents the embassy asks for after biometrics. The customer uploads each one under
// `requirementName`; the team then marks the set as handed to VFS / the embassy.
export interface IAdditionalDoc {
  _id?: mongoose.Types.ObjectId;
  name: string;
  appliesTo: string;
  requirementName: string;
  status: 'requested' | 'uploaded';
  requestedAt: Date;
}
export interface IAdditionalDocs {
  items: IAdditionalDoc[];
  note: string;
  dueDate: string;
  submittedMethod: string;
  submittedRef: string;
  submittedDate: string;
}

export interface IDispatch {
  method: '' | 'courier' | 'pickup' | 'digital';
  courier: string;
  trackingNumber: string;
  dispatchedAt: Date | null;
  notifiedAt: Date | null;
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
  // Which price list the applicant was charged from, fixed at submission. Admin-only.
  pricingTier: 'individual' | 'corporate' | 'b2b_agent';
  // Snapshot of the visa terms the applicant ticked at submission, so the record of
  // what was agreed to survives later edits to the visa type's terms.
  acceptedTerms: { text: string; required: boolean }[];
  courier: ICourierRequest;
  travellers: ITraveller[];
  parentLink: IParentLink | null;
  vfsAppointment: IVfsAppointment | null;
  additionalDocs: IAdditionalDocs | null;
  dispatch: IDispatch | null;
  /** Team member handling it. */
  assignedTo: mongoose.Types.ObjectId | null;
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

const ParentRefSchema = new Schema(
  { key: { type: String, required: true }, relation: { type: String, enum: PARENT_RELATIONS, required: true } },
  { _id: false }
);

const SubmissionSchema = new Schema<ISubmission>(
  {
    mode: { type: String, enum: ['', 'visit_vfs', 'pravasa'], default: '' },
    biometricsWithin2Years: { type: String, enum: ['', 'yes', 'no'], default: '' },
    previousVisaVerified: { type: Boolean, default: false },
    centre: { type: String, default: '' },
    reference: { type: String, default: '' },
    date: { type: String, default: '' },
    notifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const TravellerSchema = new Schema<ITraveller>(
  {
    ref: { type: String, required: true },
    key: { type: String, required: true },
    kind: { type: String, enum: ['adult', 'child'], required: true },
    label: { type: String, default: '' },
    parents: { type: [ParentRefSchema], default: [] },
    submission: { type: SubmissionSchema, default: undefined },
  },
  { _id: false }
);

const ParentLinkSchema = new Schema<IParentLink>(
  {
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    ref: { type: String, default: '' },
    parents: { type: [ParentRefSchema], default: [] },
    status: { type: String, enum: ['ok', 'broken'], default: 'ok' },
    reason: { type: String, default: '' },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VfsAppointmentSchema = new Schema<IVfsAppointment>(
  {
    centre: { type: String, default: '' },
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    reference: { type: String, default: '' },
    letterUrl: { type: String, default: '' },
    letterPublicId: { type: String, default: '' },
    letterName: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const AdditionalDocsSchema = new Schema<IAdditionalDocs>(
  {
    items: [{
      name: { type: String, required: true },
      appliesTo: { type: String, default: 'All' },
      requirementName: { type: String, required: true },
      status: { type: String, enum: ['requested', 'uploaded'], default: 'requested' },
      requestedAt: { type: Date, default: Date.now },
    }],
    note: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    submittedMethod: { type: String, default: '' },
    submittedRef: { type: String, default: '' },
    submittedDate: { type: String, default: '' },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    method: { type: String, enum: ['', 'courier', 'pickup', 'digital'], default: '' },
    courier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    dispatchedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
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
    // 0 only on a child-only order linked to a parent's application.
    adults: { type: Number, default: 1, min: 0 },
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
    // select: false keeps it out of every customer response; admin reads ask for +pricingTier.
    pricingTier: { type: String, enum: ['individual', 'corporate', 'b2b_agent'], default: 'individual', select: false },
    acceptedTerms: [{ text: { type: String }, required: { type: Boolean, default: false }, _id: false }],
    courier: { type: CourierSchema, default: () => ({}) },
    travellers: { type: [TravellerSchema], default: [] },
    parentLink: { type: ParentLinkSchema, default: null },
    vfsAppointment: { type: VfsAppointmentSchema, default: null },
    additionalDocs: { type: AdditionalDocsSchema, default: null },
    dispatch: { type: DispatchSchema, default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    referenceId: { type: String, unique: true },
  },
  { timestamps: true }
);

ApplicationSchema.index({ 'parentLink.application': 1 });

ApplicationSchema.plugin(encryptionPlugin, { fields: ['formResponses'] });

ApplicationSchema.pre('save', function (next) {
  if (!this.referenceId) {
    const num = String(Math.floor(1000 + Math.random() * 9000));
    this.referenceId = `PRS-GEN-${num}`;
  }
  next();
});

export default mongoose.model<IApplication>('Application', ApplicationSchema);
