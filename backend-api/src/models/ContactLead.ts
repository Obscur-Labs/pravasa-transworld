import mongoose, { Document, Schema } from 'mongoose';
import { INQUIRY_STATUSES, InquiryStatus } from './ServiceInquiry';

export interface IContactLead extends Document {
  name: string;
  email: string;
  phone?: string;
  message: string;
  read: boolean;
  status: InquiryStatus;
  createdAt: Date;
}

const ContactLeadSchema = new Schema<IContactLead>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new' },
  },
  { timestamps: true }
);

export default mongoose.model<IContactLead>('ContactLead', ContactLeadSchema);
