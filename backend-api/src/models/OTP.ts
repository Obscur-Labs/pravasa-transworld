import mongoose, { Document, Schema } from 'mongoose';

// Registration details wait here until the email is proven, so an unverified request
// can never create or change an account.
export interface IPendingUser {
  name: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  gstNumber?: string;
}

export interface IOTP extends Document {
  email: string;
  codeHash: string;
  role: 'user' | 'admin';
  expiresAt: Date;
  attempts: number;
  pendingUser?: IPendingUser;
  // Plain code for the local dev panel only. Never set in production.
  devCode?: string;
  createdAt: Date;
}

const PendingUserSchema = new Schema<IPendingUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ['individual', 'corporate'], default: 'individual' },
    gstNumber: { type: String, trim: true },
  },
  { _id: false }
);

const OTPSchema = new Schema<IOTP>(
  {
    email: { type: String, required: true, lowercase: true },
    codeHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    pendingUser: { type: PendingUserSchema, default: undefined },
    devCode: { type: String },
  },
  { timestamps: true }
);

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OTPSchema.index({ email: 1, role: 1 });

export default mongoose.model<IOTP>('OTP', OTPSchema);
