import mongoose, { Document, Schema } from 'mongoose';

// One record per mail actually accepted by the provider, so "did we forward this to the
// embassy, and what exactly did we send?" is answerable from the application itself.
// Written after a successful send only, a failed send leaves no row.
export interface IEmbassyMailAttachment {
  /** The Document it came from, or null once that document is deleted. */
  document: mongoose.Types.ObjectId | null;
  name: string;
  size: number;
}

export interface IEmbassyMail extends Document {
  application: mongoose.Types.ObjectId;
  to: string;
  cc: string[];
  subject: string;
  body: string;
  attachments: IEmbassyMailAttachment[];
  sentBy: mongoose.Types.ObjectId | null;
  sentByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IEmbassyMailAttachment>(
  {
    document: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const EmbassyMailSchema = new Schema<IEmbassyMail>(
  {
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    to: { type: String, required: true },
    cc: [{ type: String }],
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    attachments: { type: [AttachmentSchema], default: [] },
    sentBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    sentByName: { type: String, default: 'Admin' },
  },
  { timestamps: true }
);

export default mongoose.model<IEmbassyMail>('EmbassyMail', EmbassyMailSchema);
