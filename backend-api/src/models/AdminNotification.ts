import mongoose, { Document, Schema } from 'mongoose';

export type AdminNotificationType =
  | 'new_application'
  | 'new_lead'
  | 'payment_received'
  | 'payment_failed'
  | 'courier_shipped'
  | 'status_update'
  | 'general';

export interface IAdminNotification extends Document {
  title: string;
  message: string;
  type: AdminNotificationType;
  application: mongoose.Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}

const AdminNotificationSchema = new Schema<IAdminNotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AdminNotificationSchema.index({ createdAt: -1 });

export default mongoose.model<IAdminNotification>('AdminNotification', AdminNotificationSchema);
