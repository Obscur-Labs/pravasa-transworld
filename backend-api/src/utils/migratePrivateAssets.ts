/**
 * One-off: moves files uploaded before private storage existed (application documents,
 * vault documents, visa files) from public to authenticated delivery, then rewrites the
 * stored urls. Old public links stop working once Cloudinary's CDN invalidation lands.
 *
 *   npm run migrate:private-assets            dry run, lists what would change
 *   npm run migrate:private-assets -- --apply performs the migration
 *
 * Safe to re-run: files already private are skipped.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { initCloudinary } from '../config/cloudinary';
import ApplicationDocument from '../models/Document';
import DocumentVault from '../models/DocumentVault';
import VisaFile from '../models/VisaFile';

const MODELS = [ApplicationDocument, DocumentVault, VisaFile] as const;
const PUBLIC_ASSET = /\/(image|raw|video)\/upload\//;

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI!);
  initCloudinary();

  // One file can back several records (a vault doc reused on an application), so
  // migrate each publicId once and update every record that points at it.
  const pending = new Map<string, { url: string; resourceType: string }>();
  for (const Model of MODELS) {
    const rows = await (Model as mongoose.Model<any>).find({ url: PUBLIC_ASSET }).select('url publicId').lean<{ url: string; publicId: string }[]>();
    for (const row of rows) {
      if (row.publicId && !pending.has(row.publicId)) {
        pending.set(row.publicId, { url: row.url, resourceType: row.url.match(PUBLIC_ASSET)![1] });
      }
    }
  }

  console.log(`${pending.size} public file(s) to make private${apply ? '' : ' (dry run, pass --apply to migrate)'}`);
  if (!apply) {
    for (const publicId of pending.keys()) console.log(`  ${publicId}`);
    await mongoose.disconnect();
    return;
  }

  let done = 0;
  let failed = 0;
  for (const [publicId, { resourceType }] of pending) {
    try {
      const moved = await cloudinary.uploader.rename(publicId, publicId, {
        resource_type: resourceType,
        type: 'upload',
        to_type: 'authenticated',
        invalidate: true,
      });
      for (const Model of MODELS) {
        await (Model as mongoose.Model<any>).updateMany({ publicId }, { $set: { url: moved.secure_url } });
      }
      done++;
      console.log(`  ok   ${publicId}`);
    } catch (err: any) {
      failed++;
      console.error(`  FAIL ${publicId}: ${err?.message ?? err?.error?.message ?? err}`);
    }
  }

  console.log(`Done: ${done} migrated, ${failed} failed.`);
  await mongoose.disconnect();
  if (failed) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
