import mongoose, { Document, Schema } from 'mongoose';

export interface ICountryFaq {
  question: string;
  answer: string;
}

export interface ICountryWebContent {
  overview: string;
  requirements: string;
  processingInfo: string;
  tips: string;
  faqs: ICountryFaq[];
}

export interface ICountry extends Document {
  name: string;
  flag: string;
  code: string;
  /** Embassy/agency address applications for this country are mailed to. Remembered
   *  from the last send, so the composer pre-fills instead of being retyped. */
  embassyEmail: string;
  description: string;
  isActive: boolean;
  showOnWebsite: boolean;
  slug: string;
  images: string[];
  webContent: ICountryWebContent;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const CountrySchema = new Schema<ICountry>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    flag: { type: String, required: true },
    code: { type: String, default: '', trim: true, uppercase: true },
    embassyEmail: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    showOnWebsite: { type: Boolean, default: false },
    slug: { type: String, default: '', index: true },
    images: [{ type: String }],
    webContent: {
      overview: { type: String, default: '' },
      requirements: { type: String, default: '' },
      processingInfo: { type: String, default: '' },
      tips: { type: String, default: '' },
      faqs: [
        {
          question: { type: String, default: '' },
          answer: { type: String, default: '' },
        },
      ],
    },
  },
  { timestamps: true }
);

CountrySchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

export default mongoose.model<ICountry>('Country', CountrySchema);
