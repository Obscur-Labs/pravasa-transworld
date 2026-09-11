import mongoose, { Document, Schema } from 'mongoose';
import { IFormField, IDocumentRequirement, FormFieldSchema, DocumentRequirementSchema } from './VisaType';

export interface IFormPreset extends Document {
  name: string;
  description: string;
  formFields: IFormField[];
  documentRequirements: IDocumentRequirement[];
  createdAt: Date;
  updatedAt: Date;
}

const FormPresetSchema = new Schema<IFormPreset>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    formFields: [FormFieldSchema],
    documentRequirements: [DocumentRequirementSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IFormPreset>('FormPreset', FormPresetSchema);
