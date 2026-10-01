import mongoose, { Document, Schema } from 'mongoose';
import type { Permissions } from '../config/permissions';

/** A named set of module permissions assigned to staff accounts. */
export interface IAdminRole extends Document {
  name: string;
  description: string;
  permissions: Permissions;
  createdAt: Date;
  updatedAt: Date;
}

const AdminRoleSchema = new Schema<IAdminRole>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    // { moduleKey: 'view' | 'manage' }, validated by cleanPermissions before saving.
    permissions: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

// Names are unique regardless of case.
AdminRoleSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model<IAdminRole>('AdminRole', AdminRoleSchema);
