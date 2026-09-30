import mongoose, { Document, Schema } from 'mongoose';

// "{hours}" in a term is replaced with verificationHours, so the promise shown to the
// customer never drifts from the setting. Worded to fit both UPI and bank transfer.
export const DEFAULT_PAYMENT_TERMS = [
  'I have paid the exact amount shown above to the account shown above.',
  'I have entered the correct transaction reference (UTR). A wrong or reused reference will delay or cancel verification.',
  'I understand my payment will be verified by the Pravasa Transworld team within {hours} hours.',
  'I understand that visa processing starts only after my payment has been verified.',
  'I understand that if my payment cannot be verified, my application stays on hold until the issue is resolved.',
];

// The UPI-only wording shipped first. Configs still holding exactly that are upgraded on
// read; anything an admin edited is left alone.
export const LEGACY_UPI_TERMS = [
  'I have paid the exact amount shown above to the UPI ID shown above.',
  'I have entered the correct UPI transaction reference (UTR). A wrong or reused reference will delay or cancel verification.',
  ...DEFAULT_PAYMENT_TERMS.slice(2),
];

// Singleton, upserted via findOneAndUpdate({}, ...), edited from the admin portal.
export interface IPaymentConfig extends Document {
  upiId: string;
  payeeName: string;
  // Merchant category code of a business UPI ID. Optional; blank for none.
  merchantCode: string;
  // Bank transfer (NEFT / RTGS / IMPS) to the company current account.
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  verificationHours: number;
  terms: string[];
}

const PaymentConfigSchema = new Schema<IPaymentConfig>(
  {
    upiId: { type: String, default: '', trim: true },
    payeeName: { type: String, default: '', trim: true },
    merchantCode: { type: String, default: '', trim: true },
    bankName: { type: String, default: '', trim: true },
    accountName: { type: String, default: '', trim: true },
    accountNumber: { type: String, default: '', trim: true },
    ifsc: { type: String, default: '', trim: true, uppercase: true },
    branch: { type: String, default: '', trim: true },
    verificationHours: { type: Number, default: 24, min: 1, max: 168 },
    terms: { type: [String], default: () => [...DEFAULT_PAYMENT_TERMS] },
  },
  { timestamps: true }
);

export default mongoose.model<IPaymentConfig>('PaymentConfig', PaymentConfigSchema);
