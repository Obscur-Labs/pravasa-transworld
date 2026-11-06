import mongoose, { Document, Schema } from 'mongoose';

/** A canned inquiry reply the team picks from; {name} becomes the customer's first name. */
export interface IReplyTemplate extends Document {
  title: string;
  body: string;
  order: number;
}

const ReplyTemplateSchema = new Schema<IReplyTemplate>(
  {
    title: { type: String, required: true, trim: true, maxlength: 60 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IReplyTemplate>('ReplyTemplate', ReplyTemplateSchema);
