import mongoose, { Document, Schema } from 'mongoose';

/**
 * Proof that a customer confirmed another account's parent application with the right
 * date of birth. Submitting a child-only order checks for this instead of taking a date
 * of birth again, so the rate-limited verify endpoint is the only place to guess one.
 */
export interface IParentVerification extends Document {
  user: mongoose.Types.ObjectId;
  application: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ParentVerificationSchema = new Schema<IParentVerification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    // Expires a day later; Mongo's TTL monitor removes it.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
);

ParentVerificationSchema.index({ user: 1, application: 1 });

export default mongoose.model<IParentVerification>('ParentVerification', ParentVerificationSchema);
