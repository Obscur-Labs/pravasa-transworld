import mongoose, { Document, Schema } from 'mongoose';

// Singleton, always exactly one document, upserted via findOneAndUpdate({}, ...).
// Holds the seller-side details printed on every generated receipt/tax invoice, and the
// public contact details (phones, address, hours, website) the website shows everywhere.
export interface IReceiptConfig extends Document {
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
  phone2: string;
  website: string;
  businessHours: string;
  /** Day-by-day hours (Sunday = 0); businessHours is regenerated from it on save. */
  hoursSchedule: { day: number; open: boolean; from: string; to: string }[];
}

const ReceiptConfigSchema = new Schema<IReceiptConfig>(
  {
    companyName: { type: String, default: 'Pravasa Transworld' },
    addressLine1: { type: String, default: '' },
    addressLine2: { type: String, default: '' },
    phone: { type: String, default: '' },
    fax: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '' },
    pan: { type: String, default: '' },
    stateName: { type: String, default: '' },
    stateCode: { type: String, default: '' },
    sacCode: { type: String, default: '998555' },
    logoUrl: { type: String, default: '' },
    phone2: { type: String, default: '' },
    website: { type: String, default: '' },
    businessHours: { type: String, default: '' },
    hoursSchedule: { type: [{ day: Number, open: Boolean, from: String, to: String, _id: false }], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IReceiptConfig>('ReceiptConfig', ReceiptConfigSchema);
