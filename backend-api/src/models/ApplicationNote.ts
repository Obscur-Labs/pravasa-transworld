import mongoose, { Document, Schema } from 'mongoose';

/** An internal note on an application. Staff only; customers never see these. */
export interface IApplicationNote extends Document {
  application: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId | null;
  adminName: string;
  text: string;
  /** Team members @mentioned; each gets a notification. */
  mentions: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const ApplicationNoteSchema = new Schema<IApplicationNote>(
  {
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    adminName: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'Admin' }],
  },
  { timestamps: true }
);

export default mongoose.model<IApplicationNote>('ApplicationNote', ApplicationNoteSchema);
