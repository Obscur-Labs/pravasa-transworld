import mongoose, { Document, Schema } from 'mongoose';
import { encryptionPlugin } from '../plugins/encryptionPlugin';
import { withDeliveryUrl } from '../services/cloudinary.service';
export type VaultDocumentType = 'passport' | 'aadhar' | 'pan' | 'photograph' | 'bank_statement' | 'degree' | 'other';

export interface IDocumentVault extends Document {
  user: mongoose.Types.ObjectId;
  type: VaultDocumentType;
  label: string;
  url: string;
  publicId: string;
  extractedData: Record<string, string>;
  createdAt: Date;
}

const DocumentVaultSchema = new Schema<IDocumentVault>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['passport', 'aadhar', 'pan', 'photograph', 'bank_statement', 'degree', 'other'],
      required: true,
    },
    label: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    extractedData: { type: Map, of: String, default: {} },
  },
  { timestamps: true, toJSON: withDeliveryUrl }
);

DocumentVaultSchema.plugin(encryptionPlugin, { fields: ['extractedData'] });

export default mongoose.model<IDocumentVault>('DocumentVault', DocumentVaultSchema);
