import mongoose, { Document, Schema } from 'mongoose';

// 'online' is kept only so records from the retired card gateway still load.
export type PaymentMethod = 'upi' | 'cash' | 'manual_override' | 'online';
// pending: UPI details shown, customer has not confirmed paying yet.
// awaiting_verification: customer submitted a UTR; an admin must match it to the bank statement.
// failed: an admin rejected the submission (failureReason says why); the customer can pay again.
export type PaymentStatus = 'pending' | 'awaiting_verification' | 'completed' | 'failed' | 'refunded';

export interface IPayment extends Document {
  application: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId: string;
  gateway: string;
  // UPI transaction reference (12-digit RRN) the customer entered. Unique across payments,
  // so one bank credit can't be claimed twice. Moved to rejectedUtr on rejection.
  utr?: string;
  rejectedUtr: string;
  // The confirmations the customer ticked, verbatim, as shown at the time.
  acceptedTerms: string[];
  submittedAt: Date | null;
  // The deadline promised to the customer at submission (submittedAt + verification hours).
  verifyBy: Date | null;
  // Reminder offsets (minutes before verifyBy) already sent to admins, so none repeats.
  remindersSent: number[];
  verifiedAt: Date | null;
  verifiedBy: mongoose.Types.ObjectId | null;
  verifiedByName: string;
  promoCode?: mongoose.Types.ObjectId;
  discountApplied?: number;
  markedByAdmin: boolean;
  adminNote: string;
  receiptUrl: string;
  paidAt: Date | null;
  failureReason: string;
  failedAt: Date | null;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['upi', 'cash', 'manual_override', 'online'], default: 'upi' },
    status: { type: String, enum: ['pending', 'awaiting_verification', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, default: '' },
    gateway: { type: String, default: '' },
    utr: { type: String },
    rejectedUtr: { type: String, default: '' },
    acceptedTerms: { type: [String], default: [] },
    submittedAt: { type: Date, default: null },
    verifyBy: { type: Date, default: null },
    remindersSent: { type: [Number], default: [] },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    verifiedByName: { type: String, default: '' },
    promoCode: { type: Schema.Types.ObjectId, ref: 'PromoCode' },
    discountApplied: { type: Number, default: 0 },
    markedByAdmin: { type: Boolean, default: false },
    adminNote: { type: String, default: '' },
    receiptUrl: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PaymentSchema.index({ utr: 1 }, { unique: true, partialFilterExpression: { utr: { $exists: true } } });
PaymentSchema.index({ application: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, submittedAt: 1 });
PaymentSchema.index({ user: 1, status: 1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
