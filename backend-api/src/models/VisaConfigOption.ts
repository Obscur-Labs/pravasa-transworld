import mongoose, { Document, Schema } from 'mongoose';

// Deliberately a flat, category-discriminated lookup table (not one schema per list) so
// adding a new configurable list later (e.g. a "process type") needs no schema change,
// just a new category string and a tab in the admin UI.
export type VisaConfigCategory = 'jurisdiction' | 'visaCategory' | 'visaSubType' | 'entryType';

export interface IVisaConfigOption extends Document {
  category: VisaConfigCategory;
  value: string;
  label: string;
  order: number;
  isActive: boolean;
}

const VisaConfigOptionSchema = new Schema<IVisaConfigOption>(
  {
    category: { type: String, required: true },
    value: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VisaConfigOptionSchema.index({ category: 1, value: 1 }, { unique: true });
VisaConfigOptionSchema.index({ category: 1, order: 1 });

export default mongoose.model<IVisaConfigOption>('VisaConfigOption', VisaConfigOptionSchema);
