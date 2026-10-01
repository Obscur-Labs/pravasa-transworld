import mongoose, { Document, Schema } from 'mongoose';

/**
 * Apply-flow progress the user chose to keep ("Start over" → Save). Not an Application:
 * it never reaches admin lists, payments or statuses until it's resumed and submitted.
 */
export interface IApplicationDraft extends Document {
  user: mongoose.Types.ObjectId;
  country: mongoose.Types.ObjectId;
  visaType: mongoose.Types.ObjectId | null;
  step: number;
  travelStartDate: string;
  travelEndDate: string;
  adults: number;
  children: number;
  /** Encrypted JSON: form answers, reviewed passport details and vault picks. */
  state: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationDraftSchema = new Schema<IApplicationDraft>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    country: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
    visaType: { type: Schema.Types.ObjectId, ref: 'VisaType', default: null },
    step: { type: Number, min: 1, max: 4, default: 1 },
    travelStartDate: { type: String, default: '' },
    travelEndDate: { type: String, default: '' },
    adults: { type: Number, min: 0, default: 1 },
    children: { type: Number, min: 0, default: 0 },
    state: { type: String, default: '', select: false },
  },
  { timestamps: true }
);

export default mongoose.model<IApplicationDraft>('ApplicationDraft', ApplicationDraftSchema);
