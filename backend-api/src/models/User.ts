import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  accountType: 'individual' | 'corporate';
  // Admin-only classification of corporate accounts; never sent to the customer.
  // b2b_agent pays the visa type's B2B service fee.
  corporateType: 'corporate' | 'b2b_agent';
  gstNumber?: string;
  profilePhoto: string;
  profilePhotoPublicId: string;
  isActive: boolean;
  promoApplicable: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ['individual', 'corporate'], default: 'individual' },
    corporateType: { type: String, enum: ['corporate', 'b2b_agent'], default: 'corporate' },
    gstNumber: { type: String, trim: true },
    profilePhoto: { type: String, default: '' },
    profilePhotoPublicId: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    promoApplicable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
