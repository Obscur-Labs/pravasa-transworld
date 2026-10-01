import mongoose, { Document, Schema } from 'mongoose';

export type ActivityAction = 'create' | 'update' | 'delete';

export interface IActivityLog extends Document {
  admin: mongoose.Types.ObjectId | null;
  adminName: string;
  action: ActivityAction;
  /** Permission module the change belongs to ('team' for Team & Roles), for filtering. */
  module: string;
  entityType: string;
  entityLabel: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    adminName: { type: String, required: true },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    module: { type: String, default: '' },
    entityType: { type: String, required: true },
    entityLabel: { type: String, required: true },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ admin: 1, createdAt: -1 });
ActivityLogSchema.index({ module: 1, createdAt: -1 });

/**
 * How long entries are kept. The TTL index that enforces it is managed at start-up
 * (syncActivityLogRetention), since MongoDB won't change an existing TTL from a schema.
 */
export const logRetentionDays = () => {
  const days = Number(process.env.ACTIVITY_LOG_RETENTION_DAYS);
  return Number.isInteger(days) && days >= 7 && days <= 3650 ? days : 90;
};

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
