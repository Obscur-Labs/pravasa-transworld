import mongoose, { Document, Schema } from 'mongoose';

export interface IAdmin extends Document {
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: Date;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    role:  { type: String, default: 'Administrator', trim: true },
  },
  { timestamps: true }
);

export const toAdminProfile = (admin: IAdmin) => ({
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  phone: admin.phone,
  role: admin.role,
  createdAt: admin.createdAt,
});

export default mongoose.model<IAdmin>('Admin', AdminSchema);
