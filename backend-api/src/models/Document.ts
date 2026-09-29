import mongoose, { Document, Schema } from 'mongoose';
import { withDeliveryUrl } from '../services/cloudinary.service';

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export interface IDocument extends Document {
  application: mongoose.Types.ObjectId;
  requirementName: string;
  url: string;
  publicId: string;
  status: DocumentStatus;
  rejectionReason: string;
  docType: string;
  // Structured fields read from the uploaded image (e.g. passport OCR), keyed by display label.
  extractedData: Map<string, string>;
  uploadedAt: Date;
  reviewedAt: Date | null;
}

const DocumentSchema = new Schema<IDocument>(
  {
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    requirementName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, default: '' },
    docType: { type: String, default: '' },
    extractedData: { type: Map, of: String, default: {} },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: withDeliveryUrl }
);

export default mongoose.model<IDocument>('Document', DocumentSchema);
