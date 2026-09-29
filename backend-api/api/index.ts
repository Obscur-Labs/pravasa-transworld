import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app';
import { initCloudinary } from '../src/config/cloudinary';
import { assertEnv } from '../src/config/env';

// Fails the cold start rather than serving requests with missing secrets.
assertEnv();

// Reuse DB connection across warm invocations
const connectIfNeeded = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
    initCloudinary();
  }
};

export default async function handler(req: any, res: any) {
  await connectIfNeeded();
  return app(req, res);
}
