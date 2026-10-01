import mongoose, { Document, Schema } from 'mongoose';
import { SERVICE_KEYS, ServiceKey } from '../config/serviceInquiries';

export interface InquiryDetail {
  key: string;
  label: string;
  value: string;
}

/** A request from one of the "More Services" forms (flights, hotels, transport, insurance, forex). */
export interface IServiceInquiry extends Document {
  service: ServiceKey;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  /** Answers in form order, already formatted for display. */
  details: InquiryDetail[];
  read: boolean;
  createdAt: Date;
}

const ServiceInquirySchema = new Schema<IServiceInquiry>(
  {
    service: { type: String, enum: SERVICE_KEYS, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, required: true, trim: true },
    location: { type: String, trim: true, default: '' },
    summary: { type: String, default: '' },
    details: [{ _id: false, key: String, label: String, value: String }],
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IServiceInquiry>('ServiceInquiry', ServiceInquirySchema);
