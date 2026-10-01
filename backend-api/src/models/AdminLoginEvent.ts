import mongoose, { Document, Schema } from 'mongoose';

export const LOGIN_RESULTS = ['success', 'wrong_password', 'unknown_user', 'locked', 'disabled'] as const;
export type LoginResult = (typeof LOGIN_RESULTS)[number];

/** One admin panel sign-in attempt, successful or not. */
export interface IAdminLoginEvent extends Document {
  /** Null when the username matched no account. */
  admin: mongoose.Types.ObjectId | null;
  username: string;
  result: LoginResult;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

const AdminLoginEventSchema = new Schema<IAdminLoginEvent>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },
    username: { type: String, default: '' },
    result: { type: String, enum: LOGIN_RESULTS, required: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LOGIN_HISTORY_DAYS = 90;
AdminLoginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: LOGIN_HISTORY_DAYS * 24 * 60 * 60 });

export default mongoose.model<IAdminLoginEvent>('AdminLoginEvent', AdminLoginEventSchema);
