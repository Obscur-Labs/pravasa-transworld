import mongoose, { Document, Schema } from 'mongoose';
import { SERVICE_KEYS, ServiceKey } from '../config/serviceInquiries';

export const INQUIRY_STATUSES = ['new', 'open', 'awaiting_customer', 'converted', 'closed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];


export type ReplyChannel = 'whatsapp' | 'email' | 'both';

/** Follow-up shared by contact messages and service requests: who owns it, what was said, what it became. */
export interface InquiryWorkflow {
  assignedTo: mongoose.Types.ObjectId | null;
  replies: { body: string; channel: ReplyChannel; by: string; at: Date }[];
  convertedTo: { user: mongoose.Types.ObjectId; draft: mongoose.Types.ObjectId; visaName: string; at: Date } | null;
}

export const inquiryWorkflowFields = {
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  replies: {
    type: [{ _id: false, body: String, channel: { type: String, enum: ['whatsapp', 'email', 'both'] }, by: String, at: { type: Date, default: Date.now } }],
    default: [],
  },
  convertedTo: {
    type: new Schema({ user: { type: Schema.Types.ObjectId, ref: 'User' }, draft: { type: Schema.Types.ObjectId }, visaName: String, at: Date }, { _id: false }),
    default: null,
  },
};

export interface InquiryDetail {
  key: string;
  label: string;
  value: string;
}

/** A request from one of the "More Services" forms (flights, hotels, transport, insurance, forex). */
export interface IServiceInquiry extends Document, InquiryWorkflow {
  service: ServiceKey;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  /** Answers in form order, already formatted for display. */
  details: InquiryDetail[];
  read: boolean;
  status: InquiryStatus;
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
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new', index: true },
    ...inquiryWorkflowFields,
  },
  { timestamps: true }
);

export default mongoose.model<IServiceInquiry>('ServiceInquiry', ServiceInquirySchema);
