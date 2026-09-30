import mongoose, { Document, Schema } from 'mongoose';

export type FieldType = 'text' | 'number' | 'email' | 'date' | 'select' | 'radio' | 'textarea' | 'file';
export type ApplicantType = 'adult' | 'child' | 'both';

interface IQuestion {
  label: string;
  fieldName: string;
  type: FieldType;
  required: boolean;
  options: string[];
  placeholder: string;
}

// A follow-up revealed by its parent's answer. Empty `showWhen` means any answer reveals it.
export interface ISubField extends IQuestion {
  showWhen: string[];
}

export interface IFormField extends IQuestion {
  _id?: mongoose.Types.ObjectId;
  order: number;
  applicantType: ApplicantType;
  subFields?: ISubField[];
}

// docType: a saved document kind ('custom' for a free-form name). Passport kinds
// trigger automatic OCR data extraction when the applicant uploads the image.
export type DocumentType =
  | 'custom'
  | 'passport'
  | 'passport_front'
  | 'passport_back'
  | 'page'
  | 'photo'
  | 'aadhaar'
  | 'pan';

export interface IDocumentRequirement {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description: string;
  required: boolean;
  applicantType: ApplicantType;
  docType: DocumentType;
  ocrEnabled: boolean;
  // Shares one sequence with IFormField.order: fields and documents are authored and
  // rendered as a single interleaved list, so ordering has to span both arrays.
  order: number;
}

// A consent checkbox the applicant sees before paying. `required` blocks submission
// until ticked; `defaultChecked` pre-ticks it (still un-tickable by the applicant).
export interface IVisaTerm {
  _id?: mongoose.Types.ObjectId;
  text: string;
  required: boolean;
  defaultChecked: boolean;
  order: number;
}

// Widened to plain string, these value sets are now admin-configurable via VisaConfigOption
// (see visaConfig.controller.ts), not fixed at build time.
export type EntryType = string;
export type VisaSubType = string;
export type JurisdictionType = string;
export type VisaCategoryType = string;
export type ProcessType = 'normal' | 'express';

export interface IVisaType extends Document {
  country: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  // Per-traveler pricing: visa fee (base) + VFS fee + service fee, GST (18%) applied on top.
  // Visa and VFS fees are pass-through charges, identical for individual and corporate
  // accounts. The service fee is our own margin, so it is the only component that varies
  // by account type (and is optional, often waived for corporate).
  adultPrice: number;
  childPrice: number;
  adultVfsFee: number;
  childVfsFee: number;
  adultServiceFee: number;
  childServiceFee: number;
  corporateAdultServiceFee?: number;
  corporateChildServiceFee?: number;
  // Full separate price list for B2B agents (a corporate sub-type). Each unset component
  // falls back to the standard one (the service fee to the corporate fee first).
  // Admin-only: never sent to other customers.
  b2bAdultPrice?: number;
  b2bChildPrice?: number;
  b2bAdultVfsFee?: number;
  b2bChildVfsFee?: number;
  b2bAdultServiceFee?: number;
  b2bChildServiceFee?: number;
  processingTime: string;
  validity: string;
  entry: EntryType[];
  visaSubType: VisaSubType;
  stayDuration: string;
  jurisdiction: JurisdictionType;
  visaCategory: VisaCategoryType;
  process: ProcessType;
  formFields: IFormField[];
  documentRequirements: IDocumentRequirement[];
  terms: IVisaTerm[];
  additionalNotes: string;
  // Admin-arranged position within its country. Every listing sorts on this first so
  // the visas the admin wants promoted lead the list; name breaks ties, which keeps
  // pre-ordering records (all at 0) in the alphabetical order they used to have.
  order: number;
  isActive: boolean;
}

const questionDefinition = {
  label: { type: String, required: true },
  fieldName: { type: String, required: true },
  type: { type: String, required: true },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  placeholder: { type: String, default: '' },
};

const SubFieldSchema = new Schema<ISubField>({
  ...questionDefinition,
  showWhen: [{ type: String }],
}, { _id: false });

export const FormFieldSchema = new Schema<IFormField>({
  ...questionDefinition,
  order: { type: Number, default: 0 },
  applicantType: { type: String, enum: ['adult', 'child', 'both'], default: 'adult' },
  subFields: { type: [SubFieldSchema], default: [] },
});

export const DocumentRequirementSchema = new Schema<IDocumentRequirement>({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  required: { type: Boolean, default: true },
  applicantType: { type: String, enum: ['adult', 'child', 'both'], default: 'adult' },
  docType: {
    type: String,
    enum: ['custom', 'passport', 'passport_front', 'passport_back', 'page', 'photo', 'aadhaar', 'pan'],
    default: 'custom',
  },
  ocrEnabled: { type: Boolean },
  order: { type: Number, default: 0 },
});

export const VisaTermSchema = new Schema<IVisaTerm>({
  text: { type: String, required: true, trim: true },
  required: { type: Boolean, default: true },
  defaultChecked: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

const VisaTypeSchema = new Schema<IVisaType>(
  {
    country: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    adultPrice: { type: Number, default: 0, min: 0 },
    childPrice: { type: Number, default: 0, min: 0 },
    adultVfsFee: { type: Number, default: 0, min: 0 },
    childVfsFee: { type: Number, default: 0, min: 0 },
    adultServiceFee: { type: Number, default: 0, min: 0 },
    childServiceFee: { type: Number, default: 0, min: 0 },
    corporateAdultServiceFee: { type: Number, min: 0 },
    corporateChildServiceFee: { type: Number, min: 0 },
    b2bAdultPrice: { type: Number, min: 0 },
    b2bChildPrice: { type: Number, min: 0 },
    b2bAdultVfsFee: { type: Number, min: 0 },
    b2bChildVfsFee: { type: Number, min: 0 },
    b2bAdultServiceFee: { type: Number, min: 0 },
    b2bChildServiceFee: { type: Number, min: 0 },
    processingTime: { type: String, required: true, default: '' },
    validity: { type: String, default: '' },
    entry: [{ type: String }],
    visaSubType: { type: String, default: 'e-visa' },
    stayDuration: { type: String, default: '' },
    jurisdiction: { type: String, default: 'pan-india' },
    visaCategory: { type: String, default: 'tourist' },
    process: { type: String, enum: ['normal', 'express'], default: 'normal' },
    formFields: [FormFieldSchema],
    documentRequirements: [DocumentRequirementSchema],
    terms: [VisaTermSchema],
    additionalNotes: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IVisaType>('VisaType', VisaTypeSchema);
