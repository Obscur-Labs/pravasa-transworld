import mongoose, { Document, Schema } from 'mongoose';
import { IVisaTerm, VisaTermSchema } from './VisaType';

export interface ITermPreset extends Document {
  name: string;
  description: string;
  terms: IVisaTerm[];
}

const TermPresetSchema = new Schema<ITermPreset>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    terms: [VisaTermSchema],
  },
  { timestamps: true }
);

export default mongoose.model<ITermPreset>('TermPreset', TermPresetSchema);
