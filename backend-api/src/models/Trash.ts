import mongoose, { Document, Schema } from 'mongoose';

export type TrashEntityType = 'country' | 'visaType' | 'formPreset' | 'termPreset' | 'contactLead' | 'application' | 'user';

export interface ITrash extends Document {
  entityType: TrashEntityType;
  label: string;        // human-readable name shown in the trash list
  sublabel: string;     // optional secondary detail (e.g. country / email)
  originalId: mongoose.Types.ObjectId;
  data: Record<string, unknown>; // full snapshot of the deleted document
  deletedAt: Date;
}

const TrashSchema = new Schema<ITrash>(
  {
    entityType: { type: String, required: true, enum: ['country', 'visaType', 'formPreset', 'termPreset', 'contactLead', 'application', 'user'] },
    label: { type: String, default: '' },
    sublabel: { type: String, default: '' },
    originalId: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    deletedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<ITrash>('Trash', TrashSchema);
